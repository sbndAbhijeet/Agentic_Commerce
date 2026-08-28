import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { CartResponse, CartItemResponse } from '../types/cart'
import { cartsApi } from '../api/carts'
import { useAuth } from './AuthContext'

interface CartContextType {
  cart: CartResponse | null;
  cartId: string | null;
  isLoading: boolean;
  totalItems: number;
  totalAmount: number;
  addToCart: (productId: number, quantity?: number) => Promise<void>;
  updateQuantity: (productId: number, quantity: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  syncCart: (nextCartId: string) => Promise<CartResponse>;
  clearCartSession: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_ID_KEY = 'agentic_shop_cart_id'

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: isAuthLoading } = useAuth()
  const currentUserId = user?.id
  const [cart, setCart] = useState<CartResponse | null>(null)
  const [cartId, setCartId] = useState<string | null>(() => localStorage.getItem(CART_ID_KEY))
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Initialize or fetch active cart
  const initializeCart = useCallback(async () => {
    if (!currentUserId) {
      localStorage.removeItem(CART_ID_KEY)
      setCart(null)
      setCartId(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const existingCartId = localStorage.getItem(CART_ID_KEY)
      if (existingCartId) {
        try {
          const fetchedCart = await cartsApi.getCart(existingCartId)
          setCart(fetchedCart)
          setCartId(fetchedCart.id)
          return
        } catch {
          console.warn('Existing cart not found or expired. Creating a new one...')
          localStorage.removeItem(CART_ID_KEY)
        }
      }

      // Create new cart if none exists or previous was invalid
      const newCart = await cartsApi.createCart()
      localStorage.setItem(CART_ID_KEY, newCart.id)
      setCart(newCart)
      setCartId(newCart.id)
    } catch (err) {
      console.error('Failed to initialize cart:', err)
    } finally {
      setIsLoading(false)
    }
  }, [currentUserId])

  useEffect(() => {
    if (isAuthLoading) return
    initializeCart()
  }, [initializeCart, isAuthLoading])

  const refreshCart = async () => {
    if (!cartId) {
      await initializeCart()
      return
    }
    try {
      const data = await cartsApi.getCart(cartId)
      setCart(data)
    } catch (err) {
      console.error('Failed to refresh cart:', err)
    }
  }

  const syncCart = async (nextCartId: string) => {
    const data = await cartsApi.getCart(nextCartId)
    localStorage.setItem(CART_ID_KEY, data.id)
    setCart(data)
    setCartId(data.id)
    return data
  }

  const addToCart = async (productId: number, quantity: number = 1) => {
    setIsLoading(true)
    try {
      let activeCartId = cartId
      if (!activeCartId) {
        if (!currentUserId) throw new Error('Please login to continue')
        const newCart = await cartsApi.createCart()
        activeCartId = newCart.id
        setCartId(activeCartId)
        localStorage.setItem(CART_ID_KEY, activeCartId)
      }

      // Check if product is already in cart
      const existingItem = cart?.items.find((i: CartItemResponse) => i.product_id === productId)
      const newQty = existingItem ? existingItem.quantity + quantity : quantity

      const updated = await cartsApi.addItemToCart(activeCartId, {
        product_id: productId,
        quantity: newQty,
      })
      setCart(updated)
    } catch (err) {
      console.error('Failed to add item to cart:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const updateQuantity = async (productId: number, quantity: number) => {
    if (!cartId) return
    setIsLoading(true)
    try {
      if (quantity <= 0) {
        const existingItem = cart?.items.find((i: CartItemResponse) => i.product_id === productId)
        if (existingItem) {
          await removeFromCart(existingItem.id)
        }
        return
      }
      const updated = await cartsApi.addItemToCart(cartId, {
        product_id: productId,
        quantity,
      })
      setCart(updated)
    } catch (err) {
      console.error('Failed to update quantity:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const removeFromCart = async (cartItemId: string) => {
    if (!cartId) return
    setIsLoading(true)
    try {
      const updated = await cartsApi.removeItemFromCart(cartId, cartItemId)
      setCart(updated)
    } catch (err) {
      console.error('Failed to remove item from cart:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const clearCartSession = async () => {
    localStorage.removeItem(CART_ID_KEY)
    setCart(null)
    setCartId(null)
    await initializeCart()
  }

  const totalItems =
    cart?.items?.reduce((sum: number, item: CartItemResponse) => sum + item.quantity, 0) || 0
  const totalAmount = typeof cart?.total === 'number' ? cart.total : parseFloat(String(cart?.total || 0))

  return (
    <CartContext.Provider
      value={{
        cart,
        cartId,
        isLoading,
        totalItems,
        totalAmount,
        addToCart,
        updateQuantity,
        removeFromCart,
        refreshCart,
        syncCart,
        clearCartSession,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
