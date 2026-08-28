import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'
import { Layout } from './components/layout/Layout'
import { LandingPage } from './pages/LandingPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { OrdersPage } from './pages/OrdersPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { MerchantDashboardPage } from './pages/MerchantDashboardPage'
import { ShopPage } from './pages/ShopPage'
import { ProtectedRoute } from './components/common/ProtectedRoute'

export function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<LandingPage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="products/:id" element={<ProductDetailPage />} />
              <Route path="cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
              <Route path="checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
              <Route path="orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
              <Route path="audit-logs" element={<ProtectedRoute><AuditLogsPage /></ProtectedRoute>} />
              <Route path="merchant" element={<ProtectedRoute allowedRole="merchant"><MerchantDashboardPage /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
