import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { CartDrawer } from '../cart/CartDrawer'
import { ChatPanel } from '../chat/ChatPanel'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export const Layout: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isHomePage = location.pathname === '/'

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        onOpenCart={() => {
          if (!user) {
            navigate('/login', { state: { message: 'Please login to continue' } })
            return
          }
          setIsCartOpen(true)
        }}
        onOpenChat={() => {
          if (!user) {
            navigate('/login', { state: { message: 'Please login to continue' } })
            return
          }
          setIsChatOpen(true)
          window.dispatchEvent(new Event('campusgadgets:open-chat'))
        }}
      />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <ChatPanel embedded={isHomePage} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  )
}
