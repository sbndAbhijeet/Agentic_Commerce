interface RazorpayCheckoutResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill?: {
    name?: string
    email?: string
  }
  theme?: {
    color?: string
  }
  handler: (response: RazorpayCheckoutResponse) => void | Promise<void>
  modal?: {
    ondismiss?: () => void
  }
}

interface RazorpayCheckoutInstance {
  open: () => void
  on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void
}

interface RazorpayConstructor {
  new (options: RazorpayCheckoutOptions): RazorpayCheckoutInstance
}

interface Window {
  Razorpay?: RazorpayConstructor
}