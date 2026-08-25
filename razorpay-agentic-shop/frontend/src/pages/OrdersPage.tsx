import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Clock, ShoppingBag, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react'
import { ordersApi } from '../api/orders'
import type { OrderResponse } from '../types/order'
import { Badge } from '../components/common/Badge'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderResponse[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await ordersApi.listOrders()
      setOrders(data)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'completed' || s === 'paid') return <Badge variant="success">Completed</Badge>
    if (s === 'processing') return <Badge variant="primary">Processing</Badge>
    if (s === 'cancelled' || s === 'failed') return <Badge variant="warning">Cancelled</Badge>
    return <Badge variant="secondary">{status}</Badge>
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Order History
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track and view previous purchases and transaction statuses
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors self-start sm:self-center cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Orders</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-20">
          <LoadingSpinner size="lg" text="Retrieving orders..." />
        </div>
      ) : error ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs max-w-md mx-auto">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Failed to load orders</h3>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
          <button
            onClick={fetchOrders}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">No orders placed yet</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Once you complete a purchase, your orders and tracking details will appear right here.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Start Shopping</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const formattedTotal = new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 2,
            }).format(typeof order.total_amount === 'number' ? order.total_amount : parseFloat(String(order.total_amount || 0)))

            const formattedDate = new Date(order.created_at).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4 hover:border-slate-300 transition-colors"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Order ID:</span>
                      <code className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {order.id}
                      </code>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Placed on {formattedDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(order.status)}
                    <span className="text-base font-extrabold text-slate-900">{formattedTotal}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Items</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {order.items?.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shrink-0 border border-slate-200/60 overflow-hidden">
                          {item.product.image_url ? (
                            <img
                              src={item.product.image_url}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ShoppingBag className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {item.product.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Qty: {item.quantity} × ₹{parseFloat(String(item.price_at_purchase)).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
