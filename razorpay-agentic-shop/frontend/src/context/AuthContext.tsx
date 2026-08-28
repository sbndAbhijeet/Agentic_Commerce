import React, { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../api/auth'
import type { LoginRequest, SignupRequest } from '../api/auth'
import type { User } from '../types/auth'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (payload: LoginRequest) => Promise<User>
  signup: (payload: SignupRequest) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const ACCESS_TOKEN_KEY = 'agentic_shop_access_token'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ACCESS_TOKEN_KEY))
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(token))

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)
    authApi
      .getMe()
      .then((currentUser) => {
        if (isMounted) setUser(currentUser)
      })
      .catch(() => {
        if (isMounted) {
          localStorage.removeItem(ACCESS_TOKEN_KEY)
          setToken(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [token])

  const saveAuth = (nextToken: string, nextUser: User) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, nextToken)
    setToken(nextToken)
    setUser(nextUser)
  }

  const login = async (payload: LoginRequest) => {
    const response = await authApi.login(payload)
    saveAuth(response.access_token, response.user)
    return response.user
  }

  const signup = async (payload: SignupRequest) => {
    const response = await authApi.signup(payload)
    saveAuth(response.access_token, response.user)
    return response.user
  }

  const logout = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}