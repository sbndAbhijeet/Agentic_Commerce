import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft, ShoppingBag, Sparkles, CreditCard } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { ordersApi } from '../api/orders'
import type { OrderResponse } from '../types/order'

export const CheckoutPage: React.FC = () => {
  const { cart, cartId, totalAmount, clearCartSession } = useCart()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<OrderResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const items = cart?.items || []

  const formattedTotal = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(totalAmount)

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cartId || items.length === 0) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      // Call backend to create order from active cart
      const order = await ordersApi.createOrder(cartId)
      setCreatedOrder(order)
      // Reset cart session for next order
      await clearCartSession()
    } catch (err: unknown) {
      console.error(err)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to place order')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Success screen
  if (createdOrder) {
    const formattedOrderTotal = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(typeof createdOrder.total_amount === 'number' ? createdOrder.total_amount : parseFloat(String(createdOrder.total_amount || 0)))

    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 shadow-sm text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Order Placed Successfully</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">Thank you for your order!</h1>
            <p className="text-xs text-slate-400 mt-2">
              Order ID: <code className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">{createdOrder.id}</code>
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-left space-y-3">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Status</span>
              <span className="font-bold text-blue-600 uppercase">{createdOrder.status}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Total Amount</span>
              <span className="font-bold text-slate-900 text-sm">{formattedOrderTotal}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Items</span>
              <span className="font-semibold text-slate-700">{createdOrder.items?.length || 0} product(s)</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => navigate('/orders')}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              View My Orders
            </button>
            <Link
              to="/"
              className="px-6 py-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Nothing to checkout</h2>
        <p className="text-xs text-slate-400 mt-1">Please add items to your cart first.</p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go to Catalog</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/cart" className="text-xs font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Cart</span>
        </Link>
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Checkout</h1>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Customer Information */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">Customer Details</h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@example.com"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Payment Gateway</h2>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Razorpay Autonomous Checkout</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-linear-to-r from-slate-900 to-indigo-950 text-white space-y-2">
              <div className="flex items-center justify-between">
                <CreditCard className="w-6 h-6 text-blue-400" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Sandbox Mode</span>
              </div>
              <p className="text-xs text-slate-300">
                Order creation will initiate the transaction workflow seamlessly.
              </p>
            </div>
          </div>
        </div>

        {/* Order Items Preview and Confirmation */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">Order Items ({items.length})</h2>

            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-semibold text-slate-900 truncate">{item.product.name}</p>
                    <p className="text-slate-400">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-bold text-slate-900">
                    ₹{(item.product.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">{formattedTotal}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Shipping</span>
                <span className="text-emerald-600 font-semibold">FREE</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-extrabold text-slate-900">
                <span>Total Due</span>
                <span className="text-lg text-blue-600">{formattedTotal}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300"
            >
              {isSubmitting ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Confirm and Place Order</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Razorpay 256-bit Encrypted Checkout</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
