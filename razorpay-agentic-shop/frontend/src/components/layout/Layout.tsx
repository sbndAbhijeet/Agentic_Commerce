import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { CartDrawer } from '../cart/CartDrawer'

export const Layout: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header onOpenCart={() => setIsCartOpen(true)} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  )
}
