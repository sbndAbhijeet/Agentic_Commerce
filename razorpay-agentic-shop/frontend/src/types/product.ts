export interface Product {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  stock: number;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProductCreate {
  name: string;
  description?: string | null;
  price: number;
  category: string;
  stock?: number;
  image_url?: string | null;
  is_active?: boolean;
}
