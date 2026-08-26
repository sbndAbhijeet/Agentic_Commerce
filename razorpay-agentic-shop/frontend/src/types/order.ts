import type { Product } from './product'

export interface OrderItemResponse {
  id: string;
  product_id: number;
  quantity: number;
  price_at_purchase: number | string;
  product: Product;
}

export interface OrderResponse {
  id: string;
  user_id?: string | null;
  status: string;
  total_amount: number | string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItemResponse[];
}

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export interface OrderCreationResponse {
  order: OrderResponse;
  razorpay_order: RazorpayOrderResponse;
}

export interface PaymentVerificationRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface OrderCreate {
  cart_id: string;
  user_id?: string | null;
}
