from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional

# pyrefly: ignore [missing-import]
from app import models, schemas
# pyrefly: ignore [missing-import]
from app.database import get_db

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])

@router.post("/", response_model=schemas.OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(cart_id: UUID, user_id: UUID | None = None, db: Session = Depends(get_db)):
    # Retrieve cart
    cart = db.query(models.Cart).filter(models.Cart.id == str(cart_id)).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    # Calculate total amount
    total = 0
    for ci in cart.items:
        total += ci.quantity * ci.product.price
    # Create order
    order = models.Order(
        user_id=str(user_id) if user_id else None,
        status="pending",
        total_amount=total,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
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
    # Optionally clear cart items (not required)
    return db.query(models.Order).filter(models.Order.id == order.id).first()

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
