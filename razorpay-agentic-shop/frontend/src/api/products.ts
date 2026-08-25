import apiClient from './client'
import type { Product, ProductCreate } from '../types/product'

export interface GetProductsParams {
  skip?: number;
  limit?: number;
  category?: string;
}

export const productsApi = {
  getProducts: async (params?: GetProductsParams): Promise<Product[]> => {
    const response = await apiClient.get<Product[]>('/products/', { params })
    return response.data
  },

  searchProducts: async (query: string): Promise<Product[]> => {
    const response = await apiClient.get<Product[]>('/products/search', {
      params: { q: query },
    })
    return response.data
  },

  getProductById: async (id: number): Promise<Product> => {
    const response = await apiClient.get<Product>(`/products/${id}`)
    return response.data
  },

  createProduct: async (product: ProductCreate): Promise<Product> => {
    const response = await apiClient.post<Product>('/products/', product)
    return response.data
  },
}
