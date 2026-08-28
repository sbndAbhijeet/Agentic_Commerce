import React, { useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Braces,
  ChevronDown,
  Clock3,
  Filter,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { auditLogsApi } from '../api/audit_logs'
import type { AuditLog, JsonValue } from '../types/auditLog'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

const formatJson = (value: JsonValue | null): string => {
  if (value === null) return 'None recorded'
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

const isRecord = (value: JsonValue): value is { [key: string]: JsonValue } =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getItems = (value: JsonValue | null): JsonValue[] => (Array.isArray(value) ? value : [])

const formatTimestamp = (value: string): string =>
  new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

const MetadataValue: React.FC<{ label: string; value: string | null }> = ({ label, value }) => (
  <div className="min-w-0">
    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <code className="mt-1 block truncate text-[11px] font-medium text-slate-600" title={value || undefined}>
      {value || '—'}
    </code>
  </div>
)

const JsonDetails: React.FC<{ label: string; value: JsonValue | null; defaultOpen?: boolean }> = ({
  label,
  value,
  defaultOpen = false,
}) => (
  <details className="group rounded-xl border border-slate-200/80 bg-slate-50/70" open={defaultOpen}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-slate-700 [&::-webkit-details-marker]:hidden">
      <span className="flex items-center gap-2">
        <Braces className="h-3.5 w-3.5 text-indigo-500" />
        {label}
      </span>
      <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
    </summary>
    <pre className="max-h-72 overflow-auto border-t border-slate-200/80 px-4 py-3 text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap wrap-break-word">
      {formatJson(value)}
    </pre>
  </details>
)

const ToolCalls: React.FC<{ value: JsonValue | null }> = ({ value }) => {
  const calls = getItems(value)

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
        <Wrench className="h-3.5 w-3.5 text-blue-500" />
        Tools called
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">{calls.length}</span>
      </div>
      {calls.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400">No tools were called.</p>
      ) : (
        <div className="space-y-2">
          {calls.map((call, index) => {
            const callRecord = isRecord(call) ? call : null
            const name = callRecord && typeof callRecord.name === 'string' ? callRecord.name : `Tool call ${index + 1}`
            const args = callRecord ? callRecord.arguments ?? null : call

            return (
              <div key={`${name}-${index}`} className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <code className="text-xs font-bold text-blue-800">{name}</code>
                  {callRecord && typeof callRecord.id === 'string' && (
                    <code className="max-w-[45%] truncate text-[10px] text-blue-500" title={callRecord.id}>
                      {callRecord.id}
                    </code>
                  )}
                </div>
                <pre className="mt-2 overflow-auto text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap wrap-break-word">
                  {formatJson(args)}
                </pre>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const AuditLogCard: React.FC<{ log: AuditLog; isCurrentSession: boolean }> = ({ log, isCurrentSession }) => (
  <article className={`overflow-hidden rounded-3xl border bg-white shadow-xs transition-colors ${isCurrentSession ? 'border-blue-300 ring-2 ring-blue-100/80' : 'border-slate-200/80 hover:border-slate-300'}`}>
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
          <Activity className="h-4 w-4 text-blue-600" />
          <span>Audit event</span>
          <code className="max-w-55 truncate rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500" title={log.id}>
            {log.id}
          </code>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
          <Clock3 className="h-3.5 w-3.5" />
          <time dateTime={log.created_at}>{formatTimestamp(log.created_at)}</time>
        </div>
      </div>
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isCurrentSession ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
        {isCurrentSession ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
        {isCurrentSession ? 'Current session' : 'Recorded'}
      </span>
    </div>

    <div className="grid gap-4 px-5 py-5 sm:grid-cols-3 sm:px-6">
      <MetadataValue label="Session ID" value={log.session_id} />
      <MetadataValue label="Cart ID" value={log.cart_id} />
      <MetadataValue label="Order ID" value={log.order_id} />
    </div>

    <div className="space-y-5 border-t border-slate-100 px-5 py-5 sm:px-6">
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
          User message
        </div>
        <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
          {log.user_message}
        </p>
      </section>

      <details className="group rounded-xl border border-indigo-100 bg-indigo-50/45">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" />
            AI reply
          </span>
          <ChevronDown className="h-4 w-4 text-indigo-400 transition-transform group-open:rotate-180" />
        </summary>
        <p className="border-t border-indigo-100 px-4 py-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
          {log.agent_response || 'No response recorded.'}
        </p>
      </details>

      <ToolCalls value={log.tool_calls} />
      <JsonDetails label="Tool results" value={log.tool_results} />

      {log.reasoning && (
        <details className="group rounded-xl border border-slate-200/80 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold text-slate-600 [&::-webkit-details-marker]:hidden">
            Reasoning summary
            <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <p className="border-t border-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-500 whitespace-pre-wrap">{log.reasoning}</p>
        </details>
      )}
    </div>
  </article>
)

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [currentSessionId] = useState(() => localStorage.getItem('campusgadgets_chat_session_id') || '')
  const [sessionInput, setSessionInput] = useState('')
  const [activeSessionId, setActiveSessionId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = async (sessionId = activeSessionId) => {
    setIsLoading(true)
    setError(null)
    try {
      setLogs(await auditLogsApi.listAuditLogs(sessionId.trim() || undefined))
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchLogs()
  }, [])

  const handleFilterSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const nextSessionId = sessionInput.trim()
    setActiveSessionId(nextSessionId)
    void fetchLogs(nextSessionId)
  }

  const handleClearFilter = () => {
    setSessionInput('')
    setActiveSessionId('')
    void fetchLogs('')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
            <Activity className="h-3.5 w-3.5" /> Developer view
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">AI Logs</h1>
          <p className="mt-1 text-xs text-slate-500">Inspect recent assistant conversations, tool calls, and results.</p>
        </div>
        <button
          type="button"
          onClick={() => void fetchLogs()}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh logs
        </button>
      </div>

      <form onSubmit={handleFilterSubmit} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
        <label htmlFor="session-filter" className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="h-3.5 w-3.5 text-blue-600" />
          Filter by session ID
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="session-filter"
            type="text"
            value={sessionInput}
            onChange={(event) => setSessionInput(event.target.value)}
            placeholder="Paste a session UUID to narrow the timeline"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white"
          />
          <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-600">
            Apply filter
          </button>
          {activeSessionId && (
            <button type="button" onClick={handleClearFilter} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
              Clear
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Showing the 20 most recent events{activeSessionId ? ` for ${activeSessionId}` : ''}.</p>
      </form>

      {isLoading ? (
        <div className="py-20"><LoadingSpinner size="lg" text="Loading AI logs..." /></div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-xs">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-500" />
          <h2 className="text-base font-bold text-slate-900">Unable to load AI logs</h2>
          <p className="mt-1 text-xs text-slate-500">{error}</p>
          <button type="button" onClick={() => void fetchLogs()} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600">Try again</button>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-10 text-center shadow-xs">
          <Activity className="mx-auto mb-3 h-9 w-9 text-slate-300" />
          <h2 className="text-base font-bold text-slate-900">No audit logs found</h2>
          <p className="mt-1 text-xs text-slate-400">Try clearing the session filter or start a conversation with the assistant.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-400">
            <span>{logs.length} event{logs.length === 1 ? '' : 's'}</span>
            <span>Newest first</span>
          </div>
          {logs.map((log) => (
            <AuditLogCard key={log.id} log={log} isCurrentSession={Boolean(currentSessionId && log.session_id === currentSessionId)} />
          ))}
        </div>
      )}
    </div>
  )
}
