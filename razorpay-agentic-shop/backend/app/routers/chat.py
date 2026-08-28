"""HTTP endpoint for the CampusGadgets shopping assistant."""

from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.core.security import get_current_active_user
from app.services.agent_service import run_agent

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """Input for one shopping-assistant conversation turn."""

    message: str = Field(..., min_length=1, description="The shopper's message.")
    session_id: UUID | None = Field(
        default=None,
        description="Existing conversation ID; generated when omitted.",
    )
    cart_id: UUID | None = Field(
        default=None,
        description="Optional shopping cart ID available to the assistant.",
    )


class ChatResponse(BaseModel):
    """Result of one shopping-assistant conversation turn."""

    reply: str
    session_id: str
    cart_id: str | None = None
    order_id: str | None = None
    audit_id: str | None = None
    decision_log: dict[str, object] | None = None


@router.post("", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Send a message to the CampusGadgets shopping assistant."""
    session_id = str(request.session_id or uuid4())
    cart_id = str(request.cart_id) if request.cart_id else None
    result = run_agent(
        db=db,
        user_message=request.message,
        session_id=session_id,
        cart_id=cart_id,
        user_id=current_user.id,
    )

    order = result.get("order")
    order_id = str(order["id"]) if isinstance(order, dict) and order.get("id") else None
    response_cart = result.get("cart")
    updated_cart_id = (
        str(response_cart["id"])
        if isinstance(response_cart, dict) and response_cart.get("id")
        else cart_id
    )

    return ChatResponse(
        reply=str(result.get("answer") or result.get("error") or "I couldn't process that request."),
        session_id=session_id,
        cart_id=updated_cart_id,
        order_id=order_id,
        audit_id=str(result["audit_id"]) if result.get("audit_id") else None,
        decision_log=result.get("decision_log"),
    )
