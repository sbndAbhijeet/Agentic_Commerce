import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  BadgeIndianRupee,
  Boxes,
  PackageSearch,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { merchantApi } from '../api/merchant'
import type {
  MerchantDashboardResponse,
  MerchantInsightsResponse,
} from '../types/merchant'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

const formatCurrency = (value: number | string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(typeof value === 'number' ? value : parseFloat(String(value || 0)))

const formatDate = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export const MerchantDashboardPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<MerchantDashboardResponse | null>(null)
  const [insights, setInsights] = useState<MerchantInsightsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [insightsError, setInsightsError] = useState<string | null>(null)

  const fetchDashboard = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await merchantApi.getDashboard()
      setDashboard(data)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to load merchant dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateInsights = async () => {
    setIsGeneratingInsights(true)
    setInsightsError(null)
    try {
      const data = await merchantApi.generateInsights()
      setInsights(data)
      setDashboard(data.dashboard)
    } catch (err: unknown) {
      console.error(err)
      setInsightsError(err instanceof Error ? err.message : 'Failed to generate AI insights')
    } finally {
      setIsGeneratingInsights(false)
    }
  }

  useEffect(() => {
    void fetchDashboard()
  }, [])

  if (isLoading) {
    return (
      <div className="py-20">
        <LoadingSpinner size="lg" text="Loading merchant dashboard..." />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Failed to load dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">{error || 'Merchant dashboard is unavailable.'}</p>
        <button
          type="button"
          onClick={() => {
            void fetchDashboard()
          }}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  const stats = [
    {
      label: 'Total Orders',
      value: dashboard.total_orders.toLocaleString('en-IN'),
      icon: PackageSearch,
      accent: 'from-sky-500 to-blue-600',
    },
    {
      label: 'Revenue',
      value: formatCurrency(dashboard.total_revenue),
      icon: BadgeIndianRupee,
      accent: 'from-emerald-500 to-teal-600',
    },
    {
      label: 'Products',
      value: dashboard.total_products.toLocaleString('en-IN'),
      icon: Boxes,
      accent: 'from-violet-500 to-fuchsia-600',
    },
    {
      label: 'Low Stock',
      value: dashboard.low_stock_count.toLocaleString('en-IN'),
      icon: TriangleAlert,
      accent: 'from-amber-500 to-orange-600',
    },
  ]

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-linear-to-r from-slate-950 via-cyan-950 to-emerald-950 p-8 text-white shadow-lg">
        <div className="absolute -left-12 top-10 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Merchant performance center
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Keep inventory healthy and turn order momentum into growth.
            </h1>
            <p className="text-sm leading-relaxed text-slate-200">
              Review sales, spot low-stock risk, and generate AI guidance grounded in your current merchant metrics.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void fetchDashboard()
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                void handleGenerateInsights()
              }}
              disabled={isGeneratingInsights}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Sparkles className="h-4 w-4" />
              {isGeneratingInsights ? 'Generating...' : 'Generate AI Insights'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <article
              key={stat.label}
              className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs"
            >
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${stat.accent} text-white shadow-sm`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">{stat.value}</p>
            </article>
          )
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-950">Recent Orders</h2>
            <p className="mt-1 text-sm text-slate-500">Latest 10 orders containing your products.</p>
          </div>
          {dashboard.recent_orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              No merchant orders yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                    <th className="pb-3 font-semibold">Order</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Items</th>
                    <th className="pb-3 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recent_orders.map((order) => (
                    <tr key={order.order_id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 font-semibold text-slate-900">{order.order_id.slice(0, 8)}...</td>
                      <td className="py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600">{order.item_count}</td>
                      <td className="py-3 font-semibold text-slate-900">{formatCurrency(order.total_amount)}</td>
                      <td className="py-3 text-slate-500">{formatDate(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-950">Top Selling Products</h2>
            <p className="mt-1 text-sm text-slate-500">Best performers by paid sales volume.</p>
          </div>
          {dashboard.top_selling_products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              Paid sales will surface your top products here.
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard.top_selling_products.map((product) => (
                <article
                  key={product.product_id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      {product.units_sold} sold • {formatCurrency(product.revenue)}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className={`font-bold ${product.stock < 5 ? 'text-amber-600' : 'text-slate-700'}`}>
                      Stock {product.stock}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-950">AI Growth Insights</h2>
          <p className="mt-1 text-sm text-slate-500">Generate a business summary plus actionable next steps.</p>
        </div>

        {insightsError && (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {insightsError}
          </div>
        )}

        {!insights ? (
          <div className="mt-4 rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/70 px-5 py-10 text-center">
            <p className="text-sm font-medium text-cyan-900">
              Generate insights to turn your current dashboard stats into a growth plan.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl bg-slate-950 px-5 py-5 text-sm leading-relaxed text-slate-100">
              {insights.summary}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {insights.recommendations.map((recommendation, index) => (
                <div
                  key={`${index}-${recommendation}`}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950"
                >
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Recommendation {index + 1}
                  </p>
                  <p>{recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
