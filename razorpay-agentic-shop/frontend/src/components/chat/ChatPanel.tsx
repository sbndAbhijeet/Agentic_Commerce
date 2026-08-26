import React, { useEffect, useRef, useState } from 'react'
import { Bot, Check, Send, ShoppingCart, Sparkles, User, X } from 'lucide-react'
import { sendChatMessage } from '../../api/chat'
import { useCart } from '../../context/CartContext'

interface ChatPanelProps {
  cartId?: string | null
  sessionId?: string | null
  isOpen?: boolean
  onClose?: () => void
  embedded?: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  orderId?: string | null
}

const SESSION_ID_KEY = 'campusgadgets_chat_session_id'

const createMessage = (
  role: ChatMessage['role'],
  content: string,
  orderId?: string | null,
): ChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role,
  content,
  orderId,
})

export const ChatPanel: React.FC<ChatPanelProps> = ({
  cartId: providedCartId,
  sessionId: providedSessionId,
  isOpen = true,
  onClose,
  embedded = false,
}) => {
  const { cartId: activeCartId, syncCart, refreshCart, totalItems } = useCart()
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      'assistant',
      'Hi! I’m your CampusGadgets assistant. Tell me what you’re looking for and I’ll help you find the right gear.',
    ),
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [cartNotice, setCartNotice] = useState<string | null>(null)
  const [liveStatus, setLiveStatus] = useState('AI is warming up')
  const [isLivePreview, setIsLivePreview] = useState(true)
  const [sessionId, setSessionId] = useState<string>(() => {
    const existingSessionId = providedSessionId || localStorage.getItem(SESSION_ID_KEY)
    if (existingSessionId) return existingSessionId

    const newSessionId = crypto.randomUUID()
    localStorage.setItem(SESSION_ID_KEY, newSessionId)
    return newSessionId
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const cartId = providedCartId ?? activeCartId

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isLivePreview) return
    const statuses = ['AI is browsing the catalog', 'Checking best deals', 'Ready to help you shop']
    let statusIndex = 0
    const interval = window.setInterval(() => {
      statusIndex += 1
      setLiveStatus(statuses[statusIndex] || statuses[statuses.length - 1])
    }, 850)
    const timeout = window.setTimeout(() => setIsLivePreview(false), 2700)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [isLivePreview])

  const sendMessage = async (suggestedMessage?: string) => {
    const message = (suggestedMessage ?? input).trim()
    if (!message || isLoading) return

    setInput('')
    setCartNotice(null)
    const previousItemCount = totalItems
    setMessages((current) => [...current, createMessage('user', message)])
    setIsLoading(true)

    try {
      const response = await sendChatMessage({
        message,
        session_id: sessionId,
        ...(cartId ? { cart_id: cartId } : {}),
      })
      setSessionId(response.session_id)
      localStorage.setItem(SESSION_ID_KEY, response.session_id)
      let updatedCartItemCount = previousItemCount
      if (response.cart_id) {
        const updatedCart = await syncCart(response.cart_id)
        updatedCartItemCount = updatedCart.items.reduce((total, item) => total + item.quantity, 0)
      } else if (response.cart_id || response.order_id) {
        await refreshCart()
      }
      if (updatedCartItemCount > previousItemCount) {
        setCartNotice(`Added to cart · ${updatedCartItemCount} item${updatedCartItemCount === 1 ? '' : 's'} now in your cart`)
        window.setTimeout(() => setCartNotice(null), 3600)
      }
      setMessages((current) => [
        ...current,
        createMessage('assistant', response.reply, response.order_id),
      ])
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to reach the assistant.'
      setMessages((current) => [
        ...current,
        createMessage('assistant', `I’m sorry, something went wrong: **${errorMessage}**`),
      ])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSuggestion = (suggestion: string) => {
    void sendMessage(suggestion)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void sendMessage()
  }

  if (!isOpen) return null

  const panel = (
    <section
      className={`flex h-full w-full flex-col bg-white shadow-2xl ${embedded ? 'rounded-3xl border border-slate-200/80' : 'sm:rounded-3xl sm:border sm:border-slate-200/80'}`}
      aria-label="CampusGadgets AI Assistant"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:rounded-t-3xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-500 text-white shadow-sm shadow-blue-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold tracking-tight text-slate-900">CampusGadgets AI Assistant</h2>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-emerald-600">
              <span className={`h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)] ${isLivePreview ? 'animate-pulse' : ''}`} />
              {isLivePreview ? liveStatus : 'Online'}
              <span className="mx-0.5 h-3 w-px bg-slate-200" />
              <span className="inline-flex items-center gap-1 text-slate-500">
                <ShoppingCart className="h-3 w-3 text-blue-500" />
                {totalItems} {totalItems === 1 ? 'item' : 'items'} in cart
              </span>
            </div>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Close assistant">
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[11px] text-slate-500">
        <Check className="h-3.5 w-3.5 text-blue-600" />
        <span>Product guidance, cart help, and order support</span>
      </div>

      {cartNotice && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 shadow-xs" role="status">
          <Check className="h-3.5 w-3.5 shrink-0" />
          {cartNotice}
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/45 px-4 py-5" aria-live="polite">
        {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
        {messages.length === 1 && !isLoading && (
          <div className="space-y-2 pt-1">
            <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {['Laptop under 40k', 'Best headphones', 'Study essentials'].map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => handleSuggestion(suggestion)} className="rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1.5 text-[11px] font-semibold text-blue-700 transition-colors hover:border-blue-200 hover:bg-blue-100">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-100 bg-white p-4 sm:rounded-b-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 transition-colors focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10">
          <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} placeholder="Ask about products, prices, or your cart..." rows={1} disabled={isLoading} className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed" aria-label="Message the AI assistant" />
          <button type="submit" disabled={!input.trim() || isLoading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition-all hover:bg-blue-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400" aria-label="Send message">
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400">Press Enter to send · Shift + Enter for a new line</p>
      </form>
    </section>
  )

  return (
    <div className="fixed inset-0 z-60 pointer-events-none">
      <div
        className={`absolute inset-0 bg-slate-950/30 backdrop-blur-[2px] pointer-events-auto sm:hidden ${embedded ? 'lg:hidden' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`pointer-events-auto absolute flex flex-col ${embedded ? 'inset-0 lg:inset-y-20 lg:bottom-4 lg:left-auto lg:right-4 lg:top-20 lg:w-100' : 'inset-y-0 right-0 h-full w-full sm:inset-y-4 sm:right-4 sm:h-[calc(100%-2rem)] sm:w-100'}`}>
        {panel}
      </div>
    </div>
  )
}

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user'
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <Avatar role="assistant" />}
      <div className={`max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {isUser ? 'You' : 'AI Assistant'}
        </span>
        <div
          className={`rounded-2xl px-3.5 py-3 text-sm leading-relaxed shadow-xs ${
            isUser
              ? 'rounded-br-md bg-slate-900 text-white'
              : 'rounded-bl-md border border-slate-200/80 bg-white text-slate-700'
          }`}
        >
          <MarkdownText content={message.content} />
          {message.orderId && (
            <div className="mt-3 border-t border-slate-200/70 pt-2 text-xs font-semibold text-blue-600">
              Order created: <span className="font-mono text-[10px]">{message.orderId}</span>
            </div>
          )}
        </div>
      </div>
      {isUser && <Avatar role="user" />}
    </div>
  )
}

const Avatar: React.FC<{ role: 'user' | 'assistant' }> = ({ role }) => (
  <div className={`mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
    {role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
  </div>
)

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-2">
    <Avatar role="assistant" />
    <div className="rounded-2xl rounded-bl-md border border-slate-200/80 bg-white px-4 py-3 shadow-xs" aria-label="Assistant is typing">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500"
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </div>
    </div>
  </div>
)

const MarkdownText: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split(/\r?\n/)
  const elements: React.ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const headers = splitTableRow(line)
      index += 2
      const rows: string[][] = []
      while (index < lines.length && lines[index].includes('|')) {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }
      elements.push(
        <div key={`table-${index}`} className="my-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 font-bold text-slate-600">
              <tr>{headers.map((cell, cellIndex) => <th key={cellIndex} className="px-2.5 py-2">{renderInline(cell)}</th>)}</tr>
            </thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-slate-100">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-2.5 py-2">{renderInline(cell)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''))
        index += 1
      }
      elements.push(<ul key={`list-${index}`} className="my-1 list-disc space-y-1 pl-5">{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>)
      continue
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ''))
        index += 1
      }
      elements.push(<ol key={`ordered-${index}`} className="my-1 list-decimal space-y-1 pl-5">{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ol>)
      continue
    }

    elements.push(<p key={`paragraph-${index}`} className="mb-1 last:mb-0">{renderInline(line)}</p>)
    index += 1
  }

  return <>{elements}</>
}

const splitTableRow = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())

const renderInline = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>
    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}
