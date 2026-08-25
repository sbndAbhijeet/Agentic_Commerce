import apiClient from './client'
import type { OrderResponse } from '../types/order'

export const ordersApi = {
  createOrder: async (cartId: string, userId?: string): Promise<OrderResponse> => {
    const response = await apiClient.post<OrderResponse>('/orders/', null, {
      params: {
        cart_id: cartId,
        ...(userId ? { user_id: userId } : {}),
      },
    })
    return response.data
  },

  getOrderById: async (orderId: string): Promise<OrderResponse> => {
    const response = await apiClient.get<OrderResponse>(`/orders/${orderId}`)
    return response.data
  },

  listOrders: async (userId?: string): Promise<OrderResponse[]> => {
    const response = await apiClient.get<OrderResponse[]>('/orders/', {
      params: userId ? { user_id: userId } : undefined,
    })
    return response.data
  },
}
