import apiClient from './client'
import type { OrderCreationResponse, OrderResponse, PaymentVerificationRequest, RazorpayOrderResponse } from '../types/order'

export const ordersApi = {
  createOrder: async (cartId: string, userId?: string): Promise<OrderCreationResponse> => {
    const response = await apiClient.post<OrderCreationResponse>('/orders/', null, {
      params: {
        cart_id: cartId,
        ...(userId ? { user_id: userId } : {}),
      },
    })
    return response.data
  },

  getPaymentDetails: async (orderId: string): Promise<RazorpayOrderResponse> => {
    const response = await apiClient.post<RazorpayOrderResponse>(`/orders/${orderId}/pay`)
    return response.data
  },

  verifyPayment: async (payload: PaymentVerificationRequest): Promise<OrderResponse> => {
    const response = await apiClient.post<OrderResponse>('/orders/verify-payment', payload)
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
