"""OpenRouter-powered shopping assistant service for CampusGadgets."""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import OpenAI
from sqlalchemy.orm import Session

from app import models
from app.core.config import settings
from app.services.agent_tools import TOOL_FUNCTIONS, TOOLS_SCHEMA

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MAX_TOOL_ROUNDS = 6
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a helpful shopping assistant for CampusGadgets.

You may only use the provided tools to search products, inspect products, manage
carts, and create orders. Never invent product, stock, price, cart, or order data.
Always explain your reasoning in simple language, without revealing private
chain-of-thought. Keep responses concise but helpful.

Shopping and money safety rules:
- Never add items to a cart or create an order without clear user confirmation.
- Before calling create_order, always ask for and receive explicit confirmation.
- For multiple different products, first search for the best matches, show a clear
    recommendation list with bold names and prices in ₹, include the total cost, and
    ask for confirmation before adding anything.
- Prefer fewer, smarter tool calls. Search all required categories efficiently and
    avoid repeated searches or redundant product lookups.
- Understand follow-ups such as “add the first one”, “add both”, and “yes, add
    them” using the recent conversation and recommendations. If the reference is
    ambiguous, ask a short clarifying question instead of guessing.
- After adding items, clearly confirm what was added and state the updated cart
    total. Do not claim success unless the tool result confirms it.
- If a product is out of stock or not found, say so clearly and suggest available
    alternatives using the tools when useful.

Use clean formatting: short bullet lists or tables, bold product names, and prices
in ₹. Use cart_id from the request when available. If a cart operation needs a
cart_id and none is available, ask the user for it. Return friendly messages for
no results, invalid IDs, missing carts, unavailable stock, and tool failures.
"""


def run_agent(
    db: Session,
    user_message: str,
    session_id: str,
    cart_id: str | None = None,
) -> dict[str, Any]:
    """Process a shopping request through OpenRouter and the provided tools.

    Args:
        db: Active SQLAlchemy session used by the tools and audit log.
        user_message: The latest message from the shopper.
        session_id: Identifier used to group the conversation in the audit log.
        cart_id: Optional cart ID available to the assistant for this turn.

    Returns:
        A clean dictionary containing ``answer`` and any updated ``cart`` or
        ``order`` data. Failures are returned as an ``error`` dictionary and are
        also recorded in ``AuditLog`` when possible.
    """
    tool_calls: list[dict[str, Any]] = []
    tool_results: list[dict[str, Any]] = []
    answer = ""
    error: str | None = None

    if not isinstance(user_message, str) or not user_message.strip():
        error = "User message must not be empty."
        audit_id = _save_audit(db, session_id, user_message, answer, tool_calls, tool_results, error, cart_id)
        return {"error": error, "audit_id": audit_id}
    if not isinstance(session_id, str) or not session_id.strip():
        return {"error": "Session ID must not be empty."}
    if not _api_key_configured():
        error = "OPENROUTER_API_KEY is not configured."
        audit_id = _save_audit(db, session_id, user_message, answer, tool_calls, tool_results, error, cart_id)
        return {"error": error, "audit_id": audit_id}

    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(_load_conversation_context(db, session_id))
    messages.append(
        {
            "role": "user",
            "content": _build_user_context(user_message, cart_id),
        }
    )

    try:
        client = OpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "CampusGadgets",
            },
        )

        for _ in range(MAX_TOOL_ROUNDS):
            response = client.chat.completions.create(
                model=settings.AGENT_MODEL,
                messages=messages,
                tools=TOOLS_SCHEMA,
                tool_choice="auto",
            )
            assistant_message = response.choices[0].message
            response_tool_calls = assistant_message.tool_calls or []
            messages.append(_assistant_message_for_history(assistant_message))

            if not response_tool_calls:
                answer = assistant_message.content or "I couldn't generate a response."
                break

            for tool_call in response_tool_calls:
                call_name = tool_call.function.name
                arguments = _parse_arguments(tool_call.function.arguments)
                call_record = {
                    "id": tool_call.id,
                    "name": call_name,
                    "arguments": arguments,
                }
                tool_calls.append(call_record)
                result = _execute_tool(db, call_name, arguments, cart_id)
                tool_results.append({"id": tool_call.id, "name": call_name, "result": result})
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result, default=str),
                    }
                )
                cart_id = _update_context_from_result(result, cart_id)
        else:
            error = "Maximum tool-call rounds reached."

        if error:
            answer = (
                "That was a complex request. Let me show you the best options first "
                "so you can confirm them before I add anything to your cart."
            )
            return_value: dict[str, Any] = {"answer": answer}
            _add_updated_data(return_value, tool_results)
        else:
            return_value = {"answer": answer}
            _add_updated_data(return_value, tool_results)
    except Exception as exc:
        # Provider exceptions can contain response bodies, account metadata,
        # rate-limit headers, or internal provider names. Never return them to
        # the shopper or persist them in the audit response.
        logger.exception("OpenRouter agent request failed")
        error = _friendly_provider_error(exc)
        return_value = {"error": error}

    audit_id = _save_audit(db, session_id, user_message, answer, tool_calls, tool_results, error, cart_id)
    return_value["audit_id"] = audit_id
    return return_value


def _friendly_provider_error(exc: Exception) -> str:
    """Convert provider failures into safe messages for the chat response."""
    status_code = getattr(exc, "status_code", None)
    details = str(exc).lower()
    if status_code == 429 or "rate limit" in details or "ratelimit" in details:
        return "The shopping assistant is temporarily busy. Please try again shortly."
    return "The shopping assistant is temporarily unavailable. Please try again shortly."


def _build_user_context(user_message: str, cart_id: str | None) -> str:
    """Add request context without changing the shopper's original message."""
    if not cart_id:
        return user_message
    return f"Current cart_id: {cart_id}\n\nShopper message:\n{user_message}"


def _load_conversation_context(db: Session, session_id: str) -> list[dict[str, str]]:
    """Load a compact recent-turn summary for references such as 'add both'."""
    try:
        audit_logs = (
            db.query(models.AuditLog)
            .filter(models.AuditLog.session_id == session_id)
            .order_by(models.AuditLog.created_at.desc())
            .limit(6)
            .all()
        )
        context: list[dict[str, str]] = []
        for audit in reversed(audit_logs):
            context.append({"role": "user", "content": audit.user_message})
            if audit.agent_response:
                context.append({"role": "assistant", "content": audit.agent_response})
            if audit.tool_results:
                context.append(
                    {
                        "role": "system",
                        "content": "Previous tool results: "
                        + json.dumps(audit.tool_results, default=str),
                    }
                )
        return context
    except Exception:
        # Conversation context must never prevent a new request from running.
        return []


def _api_key_configured() -> bool:
    """Return whether the configured key is a real non-placeholder value."""
    key = settings.OPENROUTER_API_KEY.strip()
    return bool(key) and key.lower() not in {
        "your-openrouter-api-key",
        "replace-with-your-openrouter-api-key",
    }


def _parse_arguments(raw_arguments: str) -> dict[str, Any]:
    """Parse model tool arguments and return a safe error payload on failure."""
    try:
        arguments = json.loads(raw_arguments or "{}")
        return arguments if isinstance(arguments, dict) else {}
    except (TypeError, json.JSONDecodeError):
        return {}


def _execute_tool(
    db: Session,
    name: str,
    arguments: dict[str, Any],
    cart_id: str | None,
) -> dict[str, Any]:
    """Execute only registered tools, injecting request context where needed."""
    tool = TOOL_FUNCTIONS.get(name)
    if tool is None:
        return {"error": f"Tool '{name}' is not available."}

    if name in {"add_to_cart", "view_cart", "create_order"}:
        arguments = dict(arguments)
        arguments.setdefault("cart_id", cart_id)
        if not arguments.get("cart_id"):
            return {"error": "cart_id is required for this tool."}

    try:
        return tool(db, **arguments)
    except TypeError as exc:
        return {"error": f"Invalid arguments for {name}: {exc}"}
    except Exception as exc:
        return {"error": f"Tool {name} failed: {exc}"}


def _assistant_message_for_history(message: Any) -> dict[str, Any]:
    """Convert an SDK message into the JSON-compatible history format."""
    result: dict[str, Any] = {"role": "assistant", "content": message.content}
    if message.tool_calls:
        result["tool_calls"] = [
            {
                "id": call.id,
                "type": "function",
                "function": {
                    "name": call.function.name,
                    "arguments": call.function.arguments,
                },
            }
            for call in message.tool_calls
        ]
    return result


def _update_context_from_result(result: dict[str, Any], cart_id: str | None) -> str | None:
    """Carry a cart ID forward when a tool result provides one."""
    cart = result.get("cart")
    if isinstance(cart, dict) and cart.get("id"):
        return str(cart["id"])
    return cart_id


def _add_updated_data(response: dict[str, Any], tool_results: list[dict[str, Any]]) -> None:
    """Expose the latest cart and order objects returned by tools."""
    for entry in reversed(tool_results):
        result = entry["result"]
        if "cart" in result and "cart" not in response:
            response["cart"] = result["cart"]
        if "order" in result and "order" not in response:
            response["order"] = result["order"]


def _save_audit(
    db: Session,
    session_id: str,
    user_message: str,
    answer: str,
    tool_calls: list[dict[str, Any]],
    tool_results: list[dict[str, Any]],
    error: str | None,
    cart_id: str | None,
) -> str | None:
    """Persist the turn without masking the original agent result on failure."""
    try:
        order_id = None
        for entry in tool_results:
            order = entry["result"].get("order")
            if isinstance(order, dict) and order.get("id"):
                order_id = str(order["id"])
                break
        audit_log = models.AuditLog(
            session_id=session_id,
            user_message=user_message,
            agent_response=answer or error,
            tool_calls=tool_calls or None,
            tool_results=tool_results or None,
            reasoning="Final response includes a concise explanation of the assistant's actions; private chain-of-thought is not stored.",
            cart_id=cart_id,
            order_id=order_id,
        )
        db.add(audit_log)
        db.commit()
        return str(audit_log.id)
    except Exception:
        db.rollback()
        return None
