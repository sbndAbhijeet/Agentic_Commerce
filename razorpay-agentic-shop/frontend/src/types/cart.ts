import type { Product } from './product'

export interface CartItemResponse {
  id: string;
  product_id: number;
  quantity: number;
  product: Product;
}

export interface CartResponse {
  id: string;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
  items: CartItemResponse[];
  total: number | string;
}

export interface CartItemCreate {
  product_id: number;
  quantity: number;
}
