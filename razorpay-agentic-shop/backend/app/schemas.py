from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: str
    stock: int = 0
    image_url: Optional[str] = None
    is_active: bool = True

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


from typing import List
from uuid import UUID
from decimal import Decimal

class UserCreate(BaseModel):
    email: str
    full_name: Optional[str] = None
    is_active: bool = True

class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = 1

class CartItemResponse(BaseModel):
    id: UUID
    product_id: int
    quantity: int
    product: Product

    model_config = {"from_attributes": True}

class CartResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    items: List[CartItemResponse]
    total: Decimal

    model_config = {"from_attributes": True}

class OrderItemResponse(BaseModel):
    id: UUID
    product_id: int
    quantity: int
    price_at_purchase: Decimal
    product: Product

    model_config = {"from_attributes": True}

class OrderCreate(BaseModel):
    user_id: Optional[UUID] = None
    items: List[CartItemCreate]

class OrderResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    status: str
    total_amount: Decimal
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse]

    model_config = {"from_attributes": True}
