'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { SendHorizontal, Trash2, Copy, Check } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface WelcomeStats {
  totalSessions: number
  topKeyword: string
  topKeywordClicks: number
  topPage: string
  trafficTrend: number
}

interface ChatInterfaceProps {
  welcomeStats?: WelcomeStats | null
  onTitleUpdate?: (title: string) => void
  initialMessages?: Message[]
  initialHistory?: { role: string; content: string }[]
  onMessagesChange?: (messages: Message[], history: { role: string; content: string }[]) => void
}

const SUGGESTIONS = [
  'Show me declining pages',
  'What are my top 10 keywords?',
  'Compare this week vs last week',
  'Which pages have the worst CTR?',
  'Show keyword opportunities',
  'Full traffic report',
  'Position distribution breakdown',
  'Top pages by clicks',
]

const QUICK_ACTIONS = [
  { label: 'Traffic Report', query: 'Give me a full traffic report for this week' },
  { label: 'Keyword Analysis', query: 'Analyze my top 10 performing keywords with recommendations' },
  { label: 'Weekly Summary', query: 'Compare this week vs last week across all metrics' },
  { label: 'SEO Issues', query: 'Run an SEO health check and show me all issues' },
]

function badge(label: string, value: string | number, color: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:4px;background:${color}15;color:${color};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;margin:0 2px;">${label}: ${value}</span>`
}

function renderMarkdown(text: string): string {
  // Handle code blocks first (```lang\ncode\n```)
  let result = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trimEnd()
    return `<div class="code-block-wrapper group/code relative my-2"><div class="code-block-header"><span class="code-lang">${lang || 'code'}</span></div><pre class="code-block"><code>${escaped}</code></pre></div>`
  })

  result = result
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul class="space-y-1 my-1">${m}</ul>`)
    .replace(/\n/g, '<br/>')

  return result
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover/msg:opacity-100 transition-opacity"
      style={{ background: '#383838',  }}
      title="Copy message"
    >
      {copied ? <Check size={12} className="text-[#34D399]" /> : <Copy size={12} className="text-white/60" />}
    </button>
  )
}

export default function ChatInterface({ welcomeStats, onTitleUpdate, initialMessages, initialHistory, onMessagesChange }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages || [])
  const [history, setHistory] = useState<{ role: string; content: string }[]>(initialHistory || [])
  const historyRef = useRef(history)
  historyRef.current = history
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initialized = useRef(false)

  // Notify parent of message changes
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  useEffect(() => {
    if (onMessagesChange && initialized.current) {
      onMessagesChange(messages, history)
    }
  }, [messages, history, onMessagesChange])

  // Initialize welcome message
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    if (initialMessages && initialMessages.length > 0) return

    let welcomeContent = "Hey! I'm your **Point Hacks analytics AI**, powered by Claude. I have full access to your GA4 and Google Search Console data -- ask me anything about traffic, keywords, pages, CTR, rankings, or trends."

    if (welcomeStats) {
      const arrow = welcomeStats.trafficTrend > 0 ? String.fromCharCode(8593) : welcomeStats.trafficTrend < 0 ? String.fromCharCode(8595) : String.fromCharCode(8594)
      const trendColor = welcomeStats.trafficTrend > 5 ? '#34D399' : welcomeStats.trafficTrend < -5 ? '#EF4444' : '#F59E0B'
      welcomeContent += '\n\n**Quick snapshot:**\n'
      welcomeContent += badge('Sessions (7d)', welcomeStats.totalSessions.toLocaleString(), '#6366f1') + ' '
      welcomeContent += badge(`Trend ${arrow}`, `${welcomeStats.trafficTrend >= 0 ? '+' : ''}${welcomeStats.trafficTrend}%`, trendColor) + '\n'
      welcomeContent += badge('Top Keyword', welcomeStats.topKeyword, '#34D399') + ' '
      welcomeContent += badge('Top Page', welcomeStats.topPage, '#8B5CF6')
    }

    setMessages([{ role: 'assistant', content: welcomeContent, timestamp: new Date() }])
  }, [welcomeStats, initialMessages])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, isStreaming, streamingContent, scrollToBottom])

  const submitRef = useRef(submit)
  submitRef.current = submit

  useEffect(() => {
    const handler = (e: Event) => {
      const query = (e as CustomEvent).detail
      if (query) submitRef.current(query)
    }
    window.addEventListener('chat-submit', handler)
    return () => window.removeEventListener('chat-submit', handler)
  }, [])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 96) + 'px'
    }
  }, [input])

  async function submit(text: string) {
    if (!text.trim()) return
    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)
    setStreamingContent('')

    if (messagesRef.current.length <= 1 && onTitleUpdate) {
      onTitleUpdate(text.trim().length > 50 ? text.trim().slice(0, 50) + '...' : text.trim())
    }

    const newHistory = [...historyRef.current, { role: 'user', content: text.trim() }]
    setHistory(newHistory)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
      })

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('text/plain')) {
        // Streaming response
        const reader = res.body?.getReader()
        if (!reader) throw new Error('No reader')
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          accumulated += chunk
          setStreamingContent(accumulated)
        }

        const finalContent = accumulated || 'No response.'
        setHistory(prev => [...prev, { role: 'assistant', content: finalContent }])
        setIsStreaming(false)
        setStreamingContent('')
        setMessages(prev => [...prev, { role: 'assistant', content: finalContent, timestamp: new Date() }])
      } else {
        // JSON fallback (non-streaming)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'API error')
        const assistantContent = data.content
        setHistory(prev => [...prev, { role: 'assistant', content: assistantContent }])
        setIsStreaming(false)
        setMessages(prev => [...prev, { role: 'assistant', content: assistantContent, timestamp: new Date() }])
      }
    } catch (err) {
      setIsStreaming(false)
      setStreamingContent('')
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${errMsg}. Try again!`, timestamp: new Date() }])
    }
  }

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); submit(input) }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(input) }
  }

  const clearChat = () => {
    setHistory([])
    setMessages([{ role: 'assistant', content: "Chat cleared. What would you like to know?", timestamp: new Date() }])
  }

  const fmtTime = (d: Date) => {
    const date = d instanceof Date ? d : new Date(d)
    return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full relative">
      <style jsx global>{`
        .code-block-wrapper {
          border-radius: 8px;
          overflow: hidden;
          background: #1A1A1A;
          border: 1px solid #333333;
        }
        .code-block-header {
          padding: 6px 12px;
          background: #333333;
          border-bottom: 1px solid #2A2A2A;
        }
        .code-lang {
          font-size: 10px;
          text-transform: uppercase;
          color: #707070;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .code-block {
          padding: 12px;
          margin: 0;
          overflow-x: auto;
          font-size: 12px;
          line-height: 1.5;
          color: #e0e0e0;
        }
        .code-block code {
          font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
        }
        .code-block .keyword { color: #c792ea; }
        .code-block .string { color: #c3e88d; }
        .code-block .comment { color: #546e7a; }
        .code-block .number { color: #f78c6c; }
        .inline-code {
          background: #383838;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .streaming-cursor::after {
          content: '';
          display: inline-block;
          width: 2px;
          height: 14px;
          background: #34D399;
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: blink-cursor 0.8s ease-in-out infinite;
        }
      `}</style>

      <button onClick={clearChat} className="absolute top-3 right-3 z-10 p-2 rounded-lg hover:bg-white/10 transition-colors opacity-40 hover:opacity-100" title="Clear chat">
        <Trash2 size={16} />
      </button>

      <div className="flex-1 overflow-y-auto space-y-4 p-4 pt-12">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
            <div className={`${m.role === 'user' ? 'max-w-md' : 'max-w-2xl'} group/msg relative`}>
              <div
                className={m.role === 'user' ? 'rounded-2xl rounded-br-sm px-4 py-3' : 'rounded-2xl rounded-bl-sm px-4 py-3 backdrop-blur-sm'}
                style={{
                  background: m.role === 'user' ? '#333333' : '#2A2A2A',
                  border: m.role === 'assistant' ? '1px solid #333333' : 'none',
                }}
              >
                {m.role === 'assistant' ? (
                  <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                ) : (
                  <p className="text-sm leading-relaxed">{m.content}</p>
                )}
              </div>
              <CopyButton text={m.content} />
              <p className={`text-[10px] mt-1 opacity-40 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                {fmtTime(m.timestamp)}
              </p>
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {isStreaming && (
          <div className="flex justify-start animate-slide-up">
            <div className="max-w-2xl">
              <div
                className="rounded-2xl rounded-bl-sm px-4 py-3 backdrop-blur-sm"
                style={{ background: '#2A2A2A', border: '1px solid #333333' }}
              >
                {streamingContent ? (
                  <div className="text-sm leading-relaxed streaming-cursor" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} />
                ) : (
                  <div className="flex gap-1.5 items-center h-5">
                    <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 2 && !isStreaming && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => submit(s)} className="text-xs px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/10 hover:scale-105 transition-all duration-200">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
        {QUICK_ACTIONS.map((a) => (
          <button key={a.label} onClick={() => submit(a.query)} disabled={isStreaming} className="text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap transition-all duration-200 hover:scale-105 disabled:opacity-30" style={{ background: '#6366f120', border: '1px solid #6366f130' }}>
            {a.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 pt-2">
        <div className="flex items-end gap-2 p-1.5 rounded-2xl" style={{ background: '#2A2A2A', border: '1px solid #333333' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Claude anything about your analytics... (Cmd+Enter)"
            rows={1}
            className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm placeholder:opacity-40 resize-none"
            style={{ maxHeight: '96px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-30"
            style={{ background: input.trim() ? '#6366f1' : '#383838' }}
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </form>
    </div>
  )
}
