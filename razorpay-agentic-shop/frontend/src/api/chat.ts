import apiClient from './client'
import type { JsonValue } from '../types/auditLog'

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
  decision_log?: DecisionLog | null
}

export interface DecisionLogTool {
  name: string
  arguments: JsonValue
}

export interface DecisionLog {
  tools: DecisionLogTool[]
  summary: string
}

export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  const response = await apiClient.post<ChatResponse>('/chat', request)
  return response.data
}

export const chatApi = {
  sendMessage: sendChatMessage,
}
