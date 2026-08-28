export interface MerchantRecentOrder {
  order_id: string
  status: string
  item_count: number
  total_amount: number | string
  created_at: string
}

export interface MerchantTopProduct {
  product_id: number
  name: string
  units_sold: number
  revenue: number | string
  stock: number
  image_url?: string | null
}

export interface MerchantDashboardResponse {
  total_orders: number
  total_revenue: number | string
  total_products: number
  low_stock_count: number
  recent_orders: MerchantRecentOrder[]
  top_selling_products: MerchantTopProduct[]
}

export interface MerchantInsightsResponse {
  summary: string
  recommendations: string[]
  dashboard: MerchantDashboardResponse
}
