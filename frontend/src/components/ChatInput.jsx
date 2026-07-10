/**
 * components/ChatInput.jsx - Message input bar with send button.
 *
 * Features:
 *  - Auto-expanding textarea
 *  - Send on Enter (Shift+Enter for newline)
 *  - Disabled state while loading
 *  - Character counter
 */

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Send, Loader2 } from 'lucide-react'

const ChatInput = forwardRef(function ChatInput({ onSend, isLoading }, ref) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  // Expose setValue to parent via ref so suggestion buttons can populate the input
  useImperativeHandle(ref, () => ({
    setValue: (text) => {
      setValue(text)
      setTimeout(() => textareaRef.current?.focus(), 0)
    },
  }))

  // Auto-resize textarea as user types
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [value])

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-4 sm:p-5">
      <div className="glass-panel rounded-[28px] px-4 sm:px-5 py-4 sm:py-5 soft-ring">
        <div className="flex flex-wrap items-end gap-3 max-w-5xl mx-auto">
          <div className="flex-1 relative min-w-[240px]">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? 'Waiting for response...' : 'Ask a question about your documents...'}
            disabled={isLoading}
            rows={1}
            maxLength={2000}
            className={`
              w-full resize-none rounded-[22px] border px-4 py-3 pr-12 text-sm
              bg-white/90 dark:bg-slate-950/70
              border-slate-200/80 dark:border-slate-700/80
              text-slate-800 dark:text-slate-100
              placeholder-slate-400 dark:placeholder-slate-500
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 scrollbar-thin shadow-sm
            `}
          />
          {/* Character counter */}
          {value.length > 1800 && (
            <span className="absolute bottom-2 right-12 text-xs text-slate-400">
              {2000 - value.length}
            </span>
          )}
          </div>

          <button
            onClick={handleSend}
            disabled={!value.trim() || isLoading}
            className={`
              flex-shrink-0 h-12 px-5 rounded-[22px] flex items-center justify-center gap-2 font-semibold text-sm
              transition-all duration-200
              ${value.trim() && !isLoading
                ? 'bg-gradient-to-r from-primary-600 to-cyan-500 hover:from-primary-700 hover:to-cyan-600 text-white shadow-lg shadow-primary-600/20'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 max-w-5xl mx-auto">
          <p>Enter to send · Shift+Enter for a new line</p>
          <span className="inline-flex items-center rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-950/50 px-2.5 py-1">
            2,000 character limit
          </span>
        </div>
      </div>
    </div>
  )
})

export default ChatInput
