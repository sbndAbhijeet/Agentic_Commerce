import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Check } from 'lucide-react'
import type { Product } from '../../types/product'
import { useCart } from '../../context/CartContext'
import { Badge } from './Badge'

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart()
  const [isAdding, setIsAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isAdding) return

    try {
      setIsAdding(true)
      await addToCart(product.id, 1)
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 1500)
    } catch (err) {
      console.error(err)
    } finally {
      setIsAdding(false)
    }
  }

  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(product.price)

  return (
    <div className="group relative flex flex-col bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200">
      {/* Image container */}
      <Link
        to={`/products/${product.id}`}
        className="relative block aspect-4/3 w-full overflow-hidden bg-slate-100"
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              // fallback if broken image
              e.currentTarget.src = `https://placehold.co/600x400/f1f5f9/475569?text=${encodeURIComponent(product.name)}`
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-slate-100 to-slate-200 text-slate-400">
            <ShoppingBag className="w-12 h-12 stroke-[1.5]" />
          </div>
        )}

        {/* Category tag */}
        <div className="absolute top-3 left-3">
          <Badge variant="primary" className="backdrop-blur-xs bg-white/90 shadow-2xs">
            {product.category}
          </Badge>
        </div>

        {product.stock <= 0 && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center">
            <span className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-md">
              Out of stock
            </span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <Link to={`/products/${product.id}`} className="group-hover:text-blue-600 transition-colors">
          <h3 className="font-semibold text-slate-900 text-base leading-snug line-clamp-1">
            {product.name}
          </h3>
        </Link>

        <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed flex-1">
          {product.description || 'No description available.'}
        </p>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Price</span>
            <span className="text-lg font-bold text-slate-900">{formattedPrice}</span>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isAdding || product.stock <= 0}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer ${
              justAdded
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-white hover:bg-blue-600 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed'
            }`}
            title="Add to Cart"
          >
            {justAdded ? (
              <>
                <Check className="w-4 h-4" />
                <span>Added</span>
              </>
            ) : isAdding ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
