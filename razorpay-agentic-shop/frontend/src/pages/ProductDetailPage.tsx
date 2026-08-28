import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Check, ShieldCheck, Truck, RefreshCw, AlertCircle } from 'lucide-react'
import { productsApi } from '../api/products'
import  type { Product } from '../types/product'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { Badge } from '../components/common/Badge'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const { user } = useAuth()

  const [product, setProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState<number>(1)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isAdding, setIsAdding] = useState<boolean>(false)
  const [justAdded, setJustAdded] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return
      setIsLoading(true)
      setError(null)
      try {
        const data = await productsApi.getProductById(parseInt(id, 10))
        setProduct(data)
      } catch (err: unknown) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Product not found')
      } finally {
        setIsLoading(false)
      }
    }
    fetchProduct()
  }, [id])

  const handleAddToCart = async () => {
    if (!product || isAdding || product.stock <= 0) return
    if (!user) {
      navigate('/login', { state: { message: 'Please login to continue' } })
      return
    }
    try {
      setIsAdding(true)
      await addToCart(product.id, quantity)
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setIsAdding(false)
    }
  }

  if (isLoading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" text="Loading product details..." />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 p-8 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Product Not Found</h3>
        <p className="text-xs text-slate-400 mt-1">{error || 'The requested product does not exist.'}</p>
        <button
          onClick={() => navigate('/shop')}
          className="mt-5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-colors"
        >
          Back to Products
        </button>
      </div>
    )
  }

  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(product.price)

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/shop"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalog</span>
        </Link>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 p-6 sm:p-10">
          {/* Image Column */}
          <div className="aspect-square rounded-2xl bg-slate-100 overflow-hidden border border-slate-200/60 flex items-center justify-center relative">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = `https://placehold.co/800x800/f1f5f9/475569?text=${encodeURIComponent(product.name)}`
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-300">
                <ShoppingBag className="w-20 h-20 stroke-[1.5]" />
                <span className="text-xs font-medium text-slate-400 mt-2">No image provided</span>
              </div>
            )}
          </div>

          {/* Details Column */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="primary">{product.category}</Badge>
                {product.stock > 0 ? (
                  <Badge variant="success">In Stock ({product.stock} available)</Badge>
                ) : (
                  <Badge variant="warning">Out of Stock</Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                {product.name}
              </h1>

              <div className="text-3xl font-black text-slate-900">
                {formattedPrice}
              </div>

              <div className="prose prose-slate prose-sm text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                <p>{product.description || 'No detailed description available for this item.'}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-4">
                {/* Quantity selector */}
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-1">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1 || product.stock <= 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-sm font-bold text-slate-900">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock || product.stock <= 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Add to Cart button */}
                <button
                  onClick={handleAddToCart}
                  disabled={isAdding || product.stock <= 0}
                  className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-slate-900/10 ${
                    justAdded
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 hover:bg-blue-600 text-white active:scale-98 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed'
                  }`}
                >
                  {justAdded ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Added to Cart!</span>
                    </>
                  ) : isAdding ? (
                    <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5" />
                      <span>Add to Cart ({quantity})</span>
                    </>
                  )}
                </button>
              </div>

              {/* Guarantees */}
              <div className="grid grid-cols-3 gap-2 pt-4 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center gap-1">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span className="text-[11px] font-semibold text-slate-700">Free Express</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span className="text-[11px] font-semibold text-slate-700">Razorpay Safe</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center gap-1">
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  <span className="text-[11px] font-semibold text-slate-700">7 Days Return</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
