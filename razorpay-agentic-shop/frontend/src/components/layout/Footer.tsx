import React from 'react'
import { Sparkles, ShieldCheck, Zap, RefreshCw } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto bg-white border-t border-slate-200">
      {/* Value props banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-b border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Instant Agentic Checkout</h4>
              <p className="text-xs text-slate-500">Autonomous AI assisted commerce experience</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Razorpay Verified</h4>
              <p className="text-xs text-slate-500">Secure banking grade transaction gateway</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Realtime Sync</h4>
              <p className="text-xs text-slate-500">Live inventory and automatic cart sessions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span>© {new Date().getFullYear()} Agentic Commerce. Built for Razorpay Agentic Shop.</span>
        </div>
        <div className="flex gap-6 font-medium">
          <span className="hover:text-slate-600 cursor-pointer">Privacy Policy</span>
          <span className="hover:text-slate-600 cursor-pointer">Terms of Service</span>
          <span className="hover:text-slate-600 cursor-pointer">API Docs</span>
        </div>
      </div>
    </footer>
  )
}
