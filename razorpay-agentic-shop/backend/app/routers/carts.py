from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from decimal import Decimal

# pyrefly: ignore [missing-import]
from app import models, schemas
# pyrefly: ignore [missing-import]
from app.database import get_db
from app.core.security import get_current_active_user

router = APIRouter(prefix="/api/v1/carts", tags=["carts"])


def _format_cart_response(cart: models.Cart) -> schemas.CartResponse:
    total = Decimal("0.00")
    for item in cart.items:
        if item.product and item.product.price is not None:
            total += Decimal(str(item.product.price)) * item.quantity
    return schemas.CartResponse(
        id=UUID(cart.id) if isinstance(cart.id, str) else cart.id,
        user_id=UUID(cart.user_id) if cart.user_id else None,
        created_at=cart.created_at,
        updated_at=cart.updated_at,
        items=cart.items,
        total=total,
    )


@router.post("/", response_model=schemas.CartResponse, status_code=status.HTTP_201_CREATED)
def create_cart(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    cart = models.Cart(user_id=current_user.id)
    db.add(cart)
    db.commit()
    db.refresh(cart)
    return _format_cart_response(cart)


@router.get("/{cart_id}", response_model=schemas.CartResponse)
def get_cart(cart_id: UUID, current_user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    cart = db.query(models.Cart).filter(models.Cart.id == str(cart_id), models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    return _format_cart_response(cart)


@router.post("/{cart_id}/items", response_model=schemas.CartResponse)
def add_or_update_item(
    cart_id: UUID,
    item_in: schemas.CartItemCreate,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    cart = db.query(models.Cart).filter(models.Cart.id == str(cart_id), models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    product = db.query(models.Product).filter(models.Product.id == item_in.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.is_active:
        raise HTTPException(status_code=400, detail="Product is inactive")
    if product.stock < item_in.quantity:
        raise HTTPException(status_code=400, detail="Requested quantity exceeds available stock")
    cart_item = (
        db.query(models.CartItem)
        .filter(models.CartItem.cart_id == str(cart_id), models.CartItem.product_id == item_in.product_id)
        .first()
    )
    if cart_item:
        cart_item.quantity = item_in.quantity
    else:
        cart_item = models.CartItem(
            cart_id=str(cart_id), product_id=item_in.product_id, quantity=item_in.quantity
        )
        db.add(cart_item)
    db.commit()
    db.refresh(cart)
    return _format_cart_response(cart)


@router.delete("/{cart_id}/items/{product_id}", response_model=schemas.CartResponse)
def delete_item(cart_id: UUID, product_id: UUID, current_user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    cart = db.query(models.Cart).filter(models.Cart.id == str(cart_id), models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    cart_item = (
        db.query(models.CartItem)
        .filter(models.CartItem.cart_id == str(cart_id), models.CartItem.id == str(product_id))
        .first()
    )
    if not cart_item:
        raise HTTPException(status_code=404, detail="Item not found in cart")
    db.delete(cart_item)
    db.commit()
    db.refresh(cart)
    return _format_cart_response(cart)
