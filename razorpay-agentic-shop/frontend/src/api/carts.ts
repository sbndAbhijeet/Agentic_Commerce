import apiClient from './client'
import type { CartResponse, CartItemCreate } from '../types/cart'

export const cartsApi = {
  createCart: async (): Promise<CartResponse> => {
    const response = await apiClient.post<CartResponse>('/carts/', null)
    return response.data
  },

  getCart: async (cartId: string): Promise<CartResponse> => {
    const response = await apiClient.get<CartResponse>(`/carts/${cartId}`)
    return response.data
  },

  addItemToCart: async (cartId: string, item: CartItemCreate): Promise<CartResponse> => {
    const response = await apiClient.post<CartResponse>(`/carts/${cartId}/items`, item)
    return response.data
  },

  removeItemFromCart: async (cartId: string, itemId: string): Promise<CartResponse> => {
    const response = await apiClient.delete<CartResponse>(`/carts/${cartId}/items/${itemId}`)
    return response.data
  },
}
