import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRole?: 'customer' | 'merchant'
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRole,
}) => {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return null
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname, message: 'Please login to continue' }} />
  }
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to="/" replace state={{ message: 'Access denied' }} />
  }
  return <>{children}</>
}
