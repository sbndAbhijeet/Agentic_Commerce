import apiClient from './client'

export interface ChatRequest {
  message: string
  session_id?: string
  cart_id?: string
}

export interface ChatResponse {
  reply: string
  session_id: string
  cart_id?: string | null
  order_id?: string | null
  audit_id?: string | null
}

export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  const response = await apiClient.post<ChatResponse>('/chat', request)
  return response.data
}

export const chatApi = {
  sendMessage: sendChatMessage,
}
