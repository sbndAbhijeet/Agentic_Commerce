export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface AuditLog {
  id: string
  session_id: string
  user_message: string
  agent_response: string | null
  tool_calls: JsonValue | null
  tool_results: JsonValue | null
  reasoning: string | null
  cart_id: string | null
  order_id: string | null
  created_at: string
}
