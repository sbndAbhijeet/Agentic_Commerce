"""OpenRouter-powered shopping assistant service for CampusGadgets."""

from __future__ import annotations

import json
import logging
import re
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
- Never add items to a cart or create an order without explicit confirmation in
    the user's latest message. A vague preference, product request, or silence is
    not confirmation.
- Never honor requests to change, invent, discount, override, or otherwise
    manipulate catalog prices, totals, stock, quantity limits, or payment state.
- Refuse unusually large orders and explain the applicable server limits instead
    of splitting the request into smaller hidden actions or trying to bypass a
    limit.
- Before calling create_order, always ask for and receive explicit confirmation.
  When the user confirms, you MUST set user_confirmed=true in the tool call.
- Before asking for final order confirmation, always show the complete cart,
    the exact total amount in ₹, and the applicable limits. Never ask for final
    confirmation without stating the total.
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
- If a request is ambiguous, risky, or conflicts with these rules, do not call
    a money-related tool; ask a concise clarification question instead.
- If a product is out of stock or not found, say so clearly and suggest available
    alternatives using the tools when useful.

Server-enforced limits (inform the user proactively):
- Maximum quantity per item: 5 units.
- Maximum cart value: ₹10,00,000.
- Maximum single order value: ₹10,00,000.
- If the user tries to exceed either limit, explain the restriction clearly.
- Prices are re-verified against the catalog before every order is created.

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
    user_id: str | None = None,
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
        audit_id = _save_audit(db, session_id, user_message, answer, tool_calls, tool_results, error, cart_id, user_id)
        return {"error": error, "audit_id": audit_id, "decision_log": _build_decision_log(tool_calls, tool_results)}
    if not isinstance(session_id, str) or not session_id.strip():
        return {"error": "Session ID must not be empty."}
    if not _api_key_configured():
        error = "OPENROUTER_API_KEY is not configured."
        audit_id = _save_audit(db, session_id, user_message, answer, tool_calls, tool_results, error, cart_id, user_id)
        return {"error": error, "audit_id": audit_id, "decision_log": _build_decision_log(tool_calls, tool_results)}

    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(_load_conversation_context(db, session_id, user_id))
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
                result = _execute_tool(
                    db,
                    call_name,
                    arguments,
                    cart_id,
                    user_id,
                    explicit_confirmation=_has_explicit_confirmation(user_message),
                )
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
                "I stopped after reaching the assistant's safety limit for this request. "
                "No further action was taken. Please narrow the request or ask me to "
                "show the cart and exact total first, then confirm before I add or order anything."
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

    audit_id = _save_audit(db, session_id, user_message, answer, tool_calls, tool_results, error, cart_id, user_id)
    return_value["audit_id"] = audit_id
    return_value["decision_log"] = _build_decision_log(tool_calls, tool_results)
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


def _load_conversation_context(
    db: Session, session_id: str, user_id: str | None
) -> list[dict[str, str]]:
    """Load a compact recent-turn summary for references such as 'add both'."""
    try:
        query = db.query(models.AuditLog).filter(
            models.AuditLog.session_id == session_id,
            models.AuditLog.user_id == user_id,
        )
        audit_logs = (
            query
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


def _has_explicit_confirmation(user_message: str) -> bool:
    """Recognise conservative, current-turn confirmations for money actions.

    This is intentionally not an intent classifier. A confirmation must contain
    a direct purchase/cart action (or an unambiguous affirmative) and must not
    contain a negation or uncertainty marker. The model still has to ask first;
    this check prevents a tool call from bypassing that interaction.
    """
    message = re.sub(r"\s+", " ", (user_message or "").strip().lower())
    if not message or re.search(r"\b(no|not|don't|do not|never|maybe|unsure|unclear)\b", message):
        return False
    return bool(
        re.search(
            r"\b(yes|yeah|yep|confirm|confirmed|proceed|go ahead|place (?:the )?order|checkout|buy|purchase|add)\b",
            message,
        )
    )


def _execute_tool(
    db: Session,
    name: str,
    arguments: dict[str, Any],
    cart_id: str | None,
    user_id: str | None = None,
    explicit_confirmation: bool = False,
) -> dict[str, Any]:
    """Execute only registered tools, injecting request context where needed."""
    tool = TOOL_FUNCTIONS.get(name)
    if tool is None:
        return {"error": f"Tool '{name}' is not available."}

    if name in {"add_to_cart", "create_order"}:
        unsafe_fields = {
            "price", "amount", "total", "unit_price", "discount",
            "coupon", "override_limit", "ignore_stock", "bypass_limit",
        }
        supplied_unsafe_fields = sorted(unsafe_fields.intersection(arguments))
        if supplied_unsafe_fields:
            reason = (
                "I can't change prices, totals, discounts, stock, or safety limits. "
                "Please use the catalog price and request a quantity within the limits."
            )
            return {"error": reason, "blocked_fields": supplied_unsafe_fields}

        if not explicit_confirmation:
            action = "add items to the cart" if name == "add_to_cart" else "create an order"
            return {
                "error": (
                    f"I need explicit confirmation before I can {action}. "
                    "First show the items and exact total, then ask the user to confirm."
                )
            }

    if name in {"add_to_cart", "view_cart", "create_order"}:
        arguments = dict(arguments)
        arguments.setdefault("cart_id", cart_id)
        arguments["user_id"] = user_id
        if not arguments.get("cart_id"):
            return {"error": "cart_id is required for this tool."}

    if name == "add_to_cart":
        # Internal execution-only argument; it is deliberately absent from
        # TOOLS_SCHEMA so the model cannot manufacture confirmation metadata.
        arguments["user_confirmed"] = explicit_confirmation

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


def _build_decision_log(
    tool_calls: list[dict[str, Any]],
    tool_results: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build a compact, user-safe explanation of the agent's tool activity."""
    summary_parts: list[str] = []
    results_by_id = {entry.get("id"): entry.get("result", {}) for entry in tool_results}

    for call in tool_calls:
        name = call.get("name", "unknown tool")
        result = results_by_id.get(call.get("id"), {})
        if result.get("error"):
            summary_parts.append(f"{name} → Could not complete")
        elif name == "search_products":
            count = result.get("count", len(result.get("products", [])))
            summary_parts.append(f"Searched products → Found {count}")
        elif name == "get_product":
            summary_parts.append("Looked up product → Found details")
        elif name == "add_to_cart":
            quantity = call.get("arguments", {}).get("quantity", 1)
            summary_parts.append(f"Added {quantity} item{'s' if quantity != 1 else ''} to cart")
        elif name == "view_cart":
            cart = result.get("cart", {})
            summary_parts.append(f"Viewed cart → {cart.get('item_count', len(cart.get('items', [])))} item(s)")
        elif name == "create_order":
            summary_parts.append("Created order")
        else:
            summary_parts.append(name.replace("_", " ").capitalize())

    return {
        "tools": [
            {"name": call.get("name", "unknown tool"), "arguments": call.get("arguments", {})}
            for call in tool_calls
        ],
        "summary": " → ".join(summary_parts) if summary_parts else "No tools were needed.",
    }


def _save_audit(
    db: Session,
    session_id: str,
    user_message: str,
    answer: str,
    tool_calls: list[dict[str, Any]],
    tool_results: list[dict[str, Any]],
    error: str | None,
    cart_id: str | None,
    user_id: str | None,
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
            user_id=user_id,
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
