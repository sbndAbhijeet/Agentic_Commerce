import apiClient from './client'
import type { MerchantDashboardResponse, MerchantInsightsResponse } from '../types/merchant'

export const merchantApi = {
  getDashboard: async (): Promise<MerchantDashboardResponse> => {
    const response = await apiClient.get<MerchantDashboardResponse>('/merchant/dashboard')
    return response.data
  },

  generateInsights: async (): Promise<MerchantInsightsResponse> => {
    const response = await apiClient.post<MerchantInsightsResponse>('/merchant/insights')
    return response.data
  },
}
