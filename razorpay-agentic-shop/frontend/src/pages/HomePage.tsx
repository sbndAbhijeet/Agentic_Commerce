import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sparkles, SlidersHorizontal, PackageX, RefreshCw, Radio } from 'lucide-react'
import { productsApi } from '../api/products'
import type { Product } from '../types/product'
import { ProductCard } from '../components/common/ProductCard'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ChatPanel } from '../components/chat/ChatPanel'

export const HomePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentCategory = searchParams.get('category') || 'All'
  const currentQuery = searchParams.get('q') || ''

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>(['All'])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)

  const fetchProducts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      let data: Product[] = []
      if (currentQuery.trim()) {
        data = await productsApi.searchProducts(currentQuery.trim())
      } else {
        data = await productsApi.getProducts({
          category: currentCategory === 'All' ? undefined : currentCategory,
        })
      }
      setProducts(data)

      // Collect categories if fetching all
      if (currentCategory === 'All' && !currentQuery) {
        const uniqueCats = Array.from(new Set(data.map((p) => p.category).filter(Boolean)))
        setCategories(['All', ...uniqueCats])
      }
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [currentCategory, currentQuery])

  useEffect(() => {
    const openChat = () => setIsChatOpen(true)
    window.addEventListener('campusgadgets:open-chat', openChat)
    return () => window.removeEventListener('campusgadgets:open-chat', openChat)
  }, [])

  const handleCategoryClick = (cat: string) => {
    const params = new URLSearchParams(searchParams)
    if (cat === 'All') {
      params.delete('category')
    } else {
      params.set('category', cat)
    }
    params.delete('q') // reset search on category filter click
    setSearchParams(params)
  }

  const handleClearSearch = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('q')
    setSearchParams(params)
  }

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative rounded-3xl bg-linear-to-r from-slate-900 via-indigo-950 to-blue-900 p-8 sm:p-12 text-white overflow-hidden shadow-lg">
        {/* Subtle decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

        <div className="relative max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-200 border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Next-Gen Agentic Commerce Experience</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Curated Products, <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-indigo-300">
              Autonomous Checkout
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
            Explore cutting-edge tech, lifestyle gadgets, and smart accessories backed by Razorpay's seamless payment flow.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs font-semibold text-blue-700 shadow-xs">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 animate-pulse text-blue-500" />
          <span>AI is browsing catalog...</span>
        </div>
        <span className="hidden text-blue-200 sm:inline">•</span>
        <span className="text-blue-600/80">Checking best deals...</span>
        <span className="hidden text-blue-200 md:inline">•</span>
        <span className="text-blue-600/80">3 students are shopping right now</span>
        <span className="ml-auto hidden text-[10px] font-bold uppercase tracking-wider text-blue-400 sm:inline">Live</span>
      </div>

      {/* Filter and search bar status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Categories chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0 ml-1 mr-1" />
          {categories.map((cat) => {
            const isActive =
              (cat === 'All' && currentCategory === 'All' && !currentQuery) ||
              currentCategory === cat

            return (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* Results count & status */}
        <div className="text-xs font-medium text-slate-500 self-end sm:self-center">
          {currentQuery ? (
            <div className="flex items-center gap-2">
              <span>
                Search results for "<strong className="text-slate-900">{currentQuery}</strong>"
              </span>
              <button
                onClick={handleClearSearch}
                className="text-blue-600 hover:underline font-semibold"
              >
                Clear
              </button>
            </div>
          ) : (
            <span>Showing {products.length} products</span>
          )}
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="py-20">
          <LoadingSpinner size="lg" text="Loading catalog items..." />
        </div>
      ) : error ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-rose-100 p-8 shadow-xs max-w-md mx-auto">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <PackageX className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Failed to load products</h3>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
          <button
            onClick={fetchProducts}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <PackageX className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No products found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {currentQuery
              ? `We couldn't find any products matching "${currentQuery}".`
              : 'There are no active products in this category.'}
          </p>
          {(currentQuery || currentCategory !== 'All') && (
            <button
              onClick={() => {
                setSearchParams({})
              }}
              className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <ChatPanel embedded isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  )
}
