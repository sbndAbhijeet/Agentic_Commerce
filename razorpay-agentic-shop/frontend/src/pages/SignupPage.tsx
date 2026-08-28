import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export const SignupPage: React.FC = () => {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await signup({ email, password, full_name: fullName })
      navigate('/shop')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to create your account')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-tr from-blue-600 to-indigo-500 text-white shadow-sm"><Sparkles className="h-5 w-5" /></span>
          <span className="text-lg font-bold tracking-tight text-slate-900">Agentic<span className="text-blue-600">Shop</span></span>
        </Link>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Join AgenticShop</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Create your account</h1>
            <p className="mt-2 text-sm text-slate-500">Save your cart and checkout details for next time.</p>
          </div>

          {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Full name</span>
              <span className="relative block"><UserRound className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" /><input type="text" required autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white" /></span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Email address</span>
              <span className="relative block"><Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" /><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white" /></span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Password</span>
              <span className="relative block"><LockKeyhole className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" /><input type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white" /></span>
            </label>
            <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Creating account…' : 'Create account'}
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700">Sign in</Link></p>
        </section>
        <Link to="/shop" className="mt-5 block text-center text-xs font-semibold text-slate-400 hover:text-slate-700">Browse the public catalog</Link>
      </div>
    </main>
  )
}
