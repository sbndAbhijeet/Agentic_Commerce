import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShoppingCart, Search, Sparkles, Package, Store, ScrollText, LogIn, LogOut, UserRound, ChartColumnIncreasing, House } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'

interface HeaderProps {
  onOpenCart?: () => void;
  onOpenChat?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCart, onOpenChat }) => {
  const { totalItems } = useCart()
  const { user, token, isLoading: isAuthLoading, logout } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      navigate('/shop')
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
                Agentic<span className="text-blue-600">Shop</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                Razorpay Powered
              </span>
            </div>
          </Link>

          {/* Search bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex flex-1 max-w-md relative items-center"
          >
            <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, brands, categories..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-100/80 border border-transparent rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
            />
          </form>

          {/* Navigation and actions */}
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                location.pathname === '/'
                  ? 'text-blue-600 bg-blue-50/80 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <House className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </Link>

            <Link
              to="/shop"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                location.pathname === '/shop'
                  ? 'text-blue-600 bg-blue-50/80 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">Shop</span>
            </Link>

            <Link
              to="/orders"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                location.pathname.startsWith('/orders')
                  ? 'text-blue-600 bg-blue-50/80 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Orders</span>
            </Link>

            <Link
              to="/audit-logs"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                location.pathname.startsWith('/audit-logs')
                  ? 'text-blue-600 bg-blue-50/80 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ScrollText className="w-4 h-4" />
              <span className="hidden sm:inline">AI Logs</span>
            </Link>

            {user?.role === 'merchant' && (
              <Link
                to="/merchant"
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/merchant')
                    ? 'text-blue-600 bg-blue-50/80 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ChartColumnIncreasing className="w-4 h-4" />
                <span className="hidden sm:inline">Merchant</span>
              </Link>
            )}

            {onOpenChat && (
              <button
                type="button"
                onClick={onOpenChat}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                aria-label="Open CampusGadgets AI Assistant"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            )}

            {user ? (
              <button
                type="button"
                onClick={() => {
                  logout()
                  navigate('/')
                }}
                className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                title="Log out"
              >
                <UserRound className="h-4 w-4 text-blue-600" />
                <span className="hidden max-w-24 truncate lg:inline">{user.full_name || user.email}</span>
                <LogOut className="h-4 w-4" />
              </button>
            ) : token || isAuthLoading ? null : (
              <div className="flex items-center gap-1">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Login</span>
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Sign up
                </Link>
              </div>
            )}

            {/* Cart trigger */}
            <button
              onClick={onOpenCart || (() => navigate('/cart'))}
              className="relative inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-all shadow-xs cursor-pointer active:scale-95"
              aria-label="View Cart"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline font-semibold">Cart</span>
              {totalItems > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold text-slate-900 bg-blue-400 rounded-full">
                  {totalItems}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Mobile Search */}
        <div className="pb-3 md:hidden">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-100 border border-transparent rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
            />
          </form>
        </div>
      </div>
    </header>
  )
}
