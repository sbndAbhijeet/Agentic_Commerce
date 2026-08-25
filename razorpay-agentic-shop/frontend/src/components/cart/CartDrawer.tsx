import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react'
import { useCart } from '../../context/CartContext'

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { cart, totalAmount, updateQuantity, removeFromCart } = useCart()
  const navigate = useNavigate()

  if (!isOpen) return null

  const formattedTotal = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(totalAmount)

  const handleCheckout = () => {
    onClose()
    navigate('/checkout')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">Your Cart</h2>
              <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                {cart?.items?.length || 0}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-6 divide-y divide-slate-100">
            {!cart?.items || cart.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Cart is empty</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Browse through our catalog and add items you like!
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-colors"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              cart.items.map((item) => {
                const itemTotal = new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                  maximumFractionDigits: 2,
                }).format(item.product.price * item.quantity)

                return (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60">
                      {item.product.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <ShoppingBag className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/products/${item.product_id}`}
                          onClick={onClose}
                          className="text-sm font-semibold text-slate-900 hover:text-blue-600 truncate"
                        >
                          {item.product.name}
                        </Link>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        {/* Quantity Controls */}
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-bold text-slate-800">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="text-sm font-bold text-slate-900">{itemTotal}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer with subtotal and checkout button */}
          {cart?.items && cart.items.length > 0 && (
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-lg font-bold text-slate-900">{formattedTotal}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Taxes and shipping calculated at final checkout.
              </p>

              <div className="flex gap-2">
                <Link
                  to="/cart"
                  onClick={onClose}
                  className="flex-1 py-3 text-center border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 text-sm rounded-xl transition-colors"
                >
                  View Full Cart
                </Link>
                <button
                  onClick={handleCheckout}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
