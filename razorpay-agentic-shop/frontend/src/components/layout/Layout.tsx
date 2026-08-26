import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { CartDrawer } from '../cart/CartDrawer'
import { ChatPanel } from '../chat/ChatPanel'

export const Layout: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        onOpenCart={() => setIsCartOpen(true)}
        onOpenChat={() => {
          setIsChatOpen(true)
          window.dispatchEvent(new Event('campusgadgets:open-chat'))
        }}
      />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      {!isHomePage && <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />}
    </div>
  )
}
