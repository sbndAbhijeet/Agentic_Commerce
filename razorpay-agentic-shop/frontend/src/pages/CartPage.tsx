import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, ArrowLeft, Trash2, Plus, Minus, ArrowRight, ShieldCheck } from 'lucide-react'
import { useCart } from '../context/CartContext'

export const CartPage: React.FC = () => {
  const { cart, totalAmount, updateQuantity, removeFromCart, isLoading } = useCart()
  const navigate = useNavigate()

  const formattedSubtotal = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(totalAmount)

  const items = cart?.items || []

  if (items.length === 0 && !isLoading) {
    return (
      <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs max-w-lg mx-auto">
        <div className="w-20 h-20 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-5">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Your cart is empty</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
          Looks like you haven't added any products to your cart yet. Explore our curated store catalog.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-all shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Explore Products</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Shopping Cart
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review and adjust your selected items before checkout
          </p>
        </div>
        <Link
          to="/"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Continue Shopping</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Cart Items List */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
          {items.map((item) => {
            const itemPriceFormatted = new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 2,
            }).format(item.product.price)

            const itemTotalFormatted = new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 2,
            }).format(item.product.price * item.quantity)

            return (
              <div key={item.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60 flex items-center justify-center">
                  {item.product.image_url ? (
                    <img
                      src={item.product.image_url}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ShoppingBag className="w-8 h-8 text-slate-300" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      {item.product.category}
                    </span>
                  </div>
                  <Link
                    to={`/products/${item.product_id}`}
                    className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors line-clamp-1 mt-1"
                  >
                    {item.product.name}
                  </Link>
                  <p className="text-xs text-slate-400 mt-0.5">Unit Price: {itemPriceFormatted}</p>
                </div>

                {/* Controls & Total */}
                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-1">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                      title="Decrease"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-9 text-center text-xs font-bold text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                      title="Increase"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right min-w-[80px]">
                    <span className="text-base font-bold text-slate-900">{itemTotalFormatted}</span>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Order Summary Box */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Items Total ({cart?.items.length || 0})</span>
              <span className="font-semibold text-slate-900">{formattedSubtotal}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Estimated Shipping</span>
              <span className="text-emerald-600 font-semibold">Free</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Estimated Taxes</span>
              <span className="text-slate-400 font-normal">Calculated next</span>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between text-base font-extrabold text-slate-900">
              <span>Total</span>
              <span className="text-xl text-blue-600">{formattedSubtotal}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Guaranteed Safe & Secure Checkout</span>
          </div>
        </div>
      </div>
    </div>
  )
}
