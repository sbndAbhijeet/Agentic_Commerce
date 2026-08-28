import apiClient from './client'
import type { OrderCreationResponse, OrderResponse, PaymentVerificationRequest, RazorpayOrderResponse } from '../types/order'

export const ordersApi = {
  createOrder: async (cartId: string): Promise<OrderCreationResponse> => {
    const response = await apiClient.post<OrderCreationResponse>('/orders/', null, {
      params: {
        cart_id: cartId,
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

  downloadReceipt: async (orderId: string): Promise<Blob> => {
    const response = await apiClient.get<Blob>(`/orders/${orderId}/receipt.pdf`, {
      responseType: 'blob',
    })
    return response.data
  },

  listOrders: async (): Promise<OrderResponse[]> => {
    const response = await apiClient.get<OrderResponse[]>('/orders/')
    return response.data
  },
}
