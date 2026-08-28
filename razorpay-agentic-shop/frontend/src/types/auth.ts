export interface User {
  id: string
  email: string
  full_name?: string | null
  role: 'customer' | 'merchant'
  is_active: boolean
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}
