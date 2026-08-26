from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from decimal import Decimal

# pyrefly: ignore [missing-import]
from app import models, schemas
# pyrefly: ignore [missing-import]
from app.database import get_db
from app.core.config import settings
from app.services.razorpay_service import create_razorpay_order, verify_payment_signature

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])

@router.post("/", response_model=schemas.OrderCreationResponse, status_code=status.HTTP_201_CREATED)
def create_order(cart_id: UUID, user_id: UUID | None = None, db: Session = Depends(get_db)):
    # Retrieve cart
    cart = db.query(models.Cart).filter(models.Cart.id == str(cart_id)).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    if not cart.items:
        raise HTTPException(status_code=400, detail="Cannot create an order from an empty cart")
    # Calculate total amount
    total = 0
    for ci in cart.items:
        if ci.product is None or ci.product.price is None:
            raise HTTPException(status_code=400, detail=f"Product {ci.product_id} is unavailable")
        if not ci.product.is_active:
            raise HTTPException(status_code=400, detail=f"Product {ci.product_id} is inactive")
        if ci.quantity < 1 or ci.quantity > ci.product.stock:
            raise HTTPException(status_code=400, detail=f"Cart quantity for product {ci.product_id} is unavailable")
        total += ci.quantity * ci.product.price
    # Create order
    order = models.Order(
        user_id=str(user_id) if user_id else None,
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
def get_payment_details(order_id: UUID, db: Session = Depends(get_db)):
    """Return the safe Razorpay Checkout payload for a local order."""
    order = db.query(models.Order).filter(models.Order.id == str(order_id)).first()
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
def verify_payment(payload: schemas.PaymentVerificationRequest, db: Session = Depends(get_db)):
    """Verify a Razorpay Test Mode payment and mark the matching order paid."""
    order = (
        db.query(models.Order)
        .filter(models.Order.razorpay_order_id == payload.razorpay_order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "paid":
        return order
    if not verify_payment_signature(
        payload.razorpay_order_id,
        payload.razorpay_payment_id,
        payload.razorpay_signature,
    ):
        raise HTTPException(status_code=400, detail="Payment verification failed")

    order.status = "paid"
    order.razorpay_payment_id = payload.razorpay_payment_id
    db.commit()
    db.refresh(order)
    return order

@router.get("/{order_id}", response_model=schemas.OrderResponse)
def get_order(order_id: UUID, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == str(order_id)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.get("/", response_model=List[schemas.OrderResponse])
def list_orders(user_id: Optional[UUID] = None, db: Session = Depends(get_db)):
    query = db.query(models.Order)
    if user_id:
        query = query.filter(models.Order.user_id == str(user_id))
    return query.all()
