from pydantic import BaseModel, Field
from typing import Literal, Optional
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
    merchant_id: Optional[str] = None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


from typing import List, Any
from uuid import UUID
from decimal import Decimal

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    role: Literal["customer", "merchant"] = "customer"
    is_active: bool = True

class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    role: Literal["customer", "merchant"]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1, description="Quantity; the endpoint enforces the maximum of 5.")

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

class RazorpayOrderResponse(BaseModel):
    id: str
    amount: int
    currency: str
    key_id: str

class OrderCreationResponse(BaseModel):
    order: OrderResponse
    razorpay_order: RazorpayOrderResponse

class PaymentVerificationRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class AuditLogBase(BaseModel):
    session_id: str
    user_message: str
    agent_response: Optional[str] = None
    tool_calls: Optional[Any] = None
    tool_results: Optional[Any] = None
    reasoning: Optional[str] = None
    cart_id: Optional[UUID] = None
    order_id: Optional[UUID] = None

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogResponse(AuditLogBase):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class MerchantRecentOrder(BaseModel):
    order_id: UUID
    status: str
    item_count: int
    total_amount: Decimal
    created_at: datetime


class MerchantTopProduct(BaseModel):
    product_id: int
    name: str
    units_sold: int
    revenue: Decimal
    stock: int
    image_url: Optional[str] = None


class MerchantDashboardResponse(BaseModel):
    total_orders: int
    total_revenue: Decimal
    total_products: int
    low_stock_count: int
    recent_orders: List[MerchantRecentOrder]
    top_selling_products: List[MerchantTopProduct]


class MerchantInsightsResponse(BaseModel):
    summary: str
    recommendations: List[str]
    dashboard: MerchantDashboardResponse
