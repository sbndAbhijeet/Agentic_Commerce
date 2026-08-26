import { ordersApi } from '../api/orders'
import type { OrderResponse, RazorpayOrderResponse } from '../types/order'

interface CheckoutCustomer {
  name?: string
  email?: string
}

export const payWithRazorpay = (
  payment: RazorpayOrderResponse,
  customer: CheckoutCustomer = {},
): Promise<OrderResponse> => {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Razorpay Checkout could not be loaded. Please refresh and try again.'))
      return
    }

    let settled = false
    const fail = (message: string) => {
      if (!settled) {
        settled = true
        reject(new Error(message))
      }
    }

    const checkout = new window.Razorpay({
      key: payment.key_id,
      amount: payment.amount,
      currency: payment.currency,
      name: 'CampusGadgets',
      description: 'CampusGadgets Test Mode purchase',
      order_id: payment.id,
      prefill: customer,
      theme: { color: '#2563eb' },
      handler: async (response) => {
        try {
          const order = await ordersApi.verifyPayment(response)
          settled = true
          resolve(order)
        } catch (error: unknown) {
          fail(error instanceof Error ? error.message : 'Payment verification failed. Please contact support.')
        }
      },
      modal: {
        ondismiss: () => fail('Payment was cancelled. Your order is still waiting for payment.'),
      },
    })

    checkout.on('payment.failed', (response) => {
      fail(response.error?.description || 'Payment failed. Please try again.')
    })
    checkout.open()
  })
}