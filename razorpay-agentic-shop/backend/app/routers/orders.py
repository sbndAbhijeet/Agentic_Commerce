from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List
from decimal import Decimal

# pyrefly: ignore [missing-import]
from app import models, schemas
# pyrefly: ignore [missing-import]
from app.database import get_db
from app.core.config import settings
from app.services.razorpay_service import (
    create_razorpay_order,
    fetch_razorpay_payment,
    verify_payment_signature,
)
from app.services.receipt_service import build_receipt_pdf
from app.core.security import get_current_active_user
from app.services.guardrails import check_order_rate, log_blocked_action, validate_order_preconditions

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])

@router.post("/", response_model=schemas.OrderCreationResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    cart_id: UUID,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    # Retrieve cart
    cart = db.query(models.Cart).filter(models.Cart.id == str(cart_id), models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    rate_ok, rate_message = check_order_rate(db, current_user.id)
    if not rate_ok:
        log_blocked_action(
            db, action="create_order", reason=rate_message,
            user_id=current_user.id, cart_id=str(cart_id),
        )
        raise HTTPException(status_code=429, detail=rate_message)

    # ── Guardrails: full pre-order validation ────────────────────
    ok, msg = validate_order_preconditions(db, cart)
    if not ok:
        log_blocked_action(
            db, action="create_order", reason=msg,
            user_id=current_user.id, cart_id=str(cart_id),
        )
        raise HTTPException(status_code=400, detail=msg)

    # Calculate total amount (already validated above)
    total = Decimal("0.00")
    for ci in cart.items:
        total += Decimal(str(ci.product.price)) * ci.quantity
    # Create order
    order = models.Order(
        user_id=current_user.id,
        status="pending",
        total_amount=total,
    )
    db.add(order)
    db.flush()
    # Copy items to order items
    for ci in cart.items:
        order_item = models.OrderItem(
            order_id=order.id,
            product_id=ci.product_id,
            quantity=ci.quantity,
            price_at_purchase=ci.product.price,
        )
        db.add(order_item)
    db.commit()
    db.refresh(order)

    amount_in_paise = int((Decimal(str(total)) * 100).quantize(Decimal("1")))
    try:
        razorpay_order = create_razorpay_order(
            amount_in_paise=amount_in_paise,
            receipt=order.id,
            notes={"local_order_id": order.id, "cart_id": str(cart_id)},
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unable to create Razorpay order: {exc}",
        ) from exc

    razorpay_order_id = razorpay_order.get("id")
    if not razorpay_order_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Razorpay returned an invalid order response",
        )
    order.razorpay_order_id = razorpay_order_id
    db.commit()
    db.refresh(order)
    # Optionally clear cart items (not required)
    return {
        "order": order,
        "razorpay_order": {
            "id": razorpay_order_id,
            "amount": int(razorpay_order.get("amount", amount_in_paise)),
            "currency": razorpay_order.get("currency", "INR"),
            "key_id": settings.RAZORPAY_KEY_ID,
        },
    }

@router.post("/{order_id}/pay", response_model=schemas.RazorpayOrderResponse)
def get_payment_details(order_id: UUID, current_user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Return the safe Razorpay Checkout payload for a local order."""
    order = db.query(models.Order).filter(models.Order.id == str(order_id), models.Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.razorpay_order_id:
        raise HTTPException(status_code=409, detail="Razorpay order has not been created")
    if not settings.RAZORPAY_KEY_ID.strip():
        raise HTTPException(status_code=503, detail="Razorpay is not configured")
    if not settings.RAZORPAY_KEY_ID.strip().startswith("rzp_test_"):
        raise HTTPException(status_code=503, detail="Only Razorpay Test Mode is supported")

    return {
        "id": order.razorpay_order_id,
        "amount": int((Decimal(str(order.total_amount)) * 100).quantize(Decimal("1"))),
        "currency": "INR",
        "key_id": settings.RAZORPAY_KEY_ID,
    }

@router.post("/verify-payment", response_model=schemas.OrderResponse)
def verify_payment(payload: schemas.PaymentVerificationRequest, current_user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Verify a Razorpay Test Mode payment and mark the matching order paid."""
    order = (
        db.query(models.Order)
        .filter(models.Order.razorpay_order_id == payload.razorpay_order_id, models.Order.user_id == current_user.id)
        .first()
    )
    if not order:
        _log_payment_verification(
            db,
            None,
            payload.razorpay_payment_id,
            "Payment verification failed: order not found.",
            success=False,
            user_id=current_user.id,
            razorpay_order_id=payload.razorpay_order_id,
        )
        raise HTTPException(status_code=404, detail="Order not found")

    # Preserve idempotent retries for the same already-verified payment, but
    # never allow a different payment ID to bypass verification.
    if order.status == "paid" and order.razorpay_payment_id == payload.razorpay_payment_id:
        _log_payment_verification(
            db, order, payload.razorpay_payment_id,
            "Payment verification retried for an already-paid order.",
        )
        return order
    if order.status == "paid":
        reason = "This order is already paid and cannot accept another payment."
        _log_payment_verification(db, order, payload.razorpay_payment_id, reason, success=False)
        raise HTTPException(status_code=409, detail=reason)

    payment_used = (
        db.query(models.Order)
        .filter(
            models.Order.razorpay_payment_id == payload.razorpay_payment_id,
            models.Order.id != order.id,
        )
        .first()
    )
    if payment_used:
        reason = "This payment has already been used for another order."
        _log_payment_verification(db, order, payload.razorpay_payment_id, reason, success=False)
        raise HTTPException(status_code=409, detail=reason)

    try:
        signature_valid = verify_payment_signature(
            payload.razorpay_order_id,
            payload.razorpay_payment_id,
            payload.razorpay_signature,
        )
    except Exception:
        signature_valid = False
    if not signature_valid:
        reason = "Payment verification failed: invalid Razorpay signature."
        if order.status not in {"paid", "failed"}:
            order.status = "pending"
            db.commit()
        _log_payment_verification(db, order, payload.razorpay_payment_id, reason, success=False)
        raise HTTPException(status_code=400, detail=reason)

    try:
        payment = fetch_razorpay_payment(payload.razorpay_payment_id)
    except Exception:
        reason = "Payment verification failed: payment details could not be confirmed with Razorpay."
        if order.status != "paid":
            order.status = "pending"
            db.commit()
        _log_payment_verification(db, order, payload.razorpay_payment_id, reason, success=False)
        raise HTTPException(status_code=502, detail=reason)

    expected_amount = int((Decimal(str(order.total_amount)) * 100).quantize(Decimal("1")))
    paid_amount = payment.get("amount")
    gateway_order_id = payment.get("order_id")
    if gateway_order_id != order.razorpay_order_id:
        reason = "Payment verification failed: payment does not belong to this order."
        _log_payment_verification(db, order, payload.razorpay_payment_id, reason, success=False)
        raise HTTPException(status_code=400, detail=reason)
    if not isinstance(paid_amount, int) or isinstance(paid_amount, bool) or paid_amount != expected_amount:
        reason = "Payment verification failed: paid amount does not match the order total."
        _log_payment_verification(db, order, payload.razorpay_payment_id, reason, success=False)
        raise HTTPException(status_code=400, detail=reason)

    order.status = "paid"
    order.razorpay_payment_id = payload.razorpay_payment_id
    db.commit()
    db.refresh(order)
    _log_payment_verification(
        db, order, payload.razorpay_payment_id,
        "Payment signature and amount verified successfully.",
    )
    return order


def _log_payment_verification(
    db: Session,
    order: models.Order | None,
    payment_id: str,
    message: str,
    success: bool = True,
    user_id: str | None = None,
    razorpay_order_id: str | None = None,
) -> None:
    """Record payment verification outcomes without exposing signatures."""
    try:
        audit = models.AuditLog(
            session_id=f"payment:{order.id if order else razorpay_order_id or 'unknown'}",
            user_id=order.user_id if order else user_id,
            user_message="[PAYMENT_VERIFICATION]",
            agent_response=message,
            reasoning="Razorpay payment verification succeeded." if success else "Razorpay payment verification was blocked.",
            tool_results={
                "success": success,
                "razorpay_order_id": order.razorpay_order_id if order else razorpay_order_id,
                "razorpay_payment_id": payment_id,
            },
            order_id=order.id if order else None,
        )
        db.add(audit)
        db.commit()
    except Exception:
        db.rollback()

@router.get("/{order_id}", response_model=schemas.OrderResponse)
def get_order(order_id: UUID, current_user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == str(order_id), models.Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.get("/{order_id}/receipt.pdf")
def download_receipt(order_id: UUID, current_user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Download the receipt for a successfully paid order."""
    order = db.query(models.Order).filter(models.Order.id == str(order_id), models.Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "paid":
        raise HTTPException(status_code=409, detail="Receipt is available after payment is verified")
    if not order.razorpay_order_id or not order.razorpay_payment_id:
        raise HTTPException(status_code=409, detail="Payment details are incomplete")

    pdf = build_receipt_pdf(order)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="CampusGadgets-Receipt-{order.id}.pdf"'},
    )

@router.get("/", response_model=List[schemas.OrderResponse])
def list_orders(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Order).filter(models.Order.user_id == current_user.id).all()
