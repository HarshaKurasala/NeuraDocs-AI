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
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-end gap-3 max-w-4xl mx-auto">
        <div className="flex-1 relative">
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
              w-full resize-none rounded-xl border px-4 py-3 pr-12 text-sm
              bg-gray-50 dark:bg-gray-800
              border-gray-200 dark:border-gray-600
              text-gray-800 dark:text-gray-200
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 scrollbar-thin
            `}
          />
          {/* Character counter */}
          {value.length > 1800 && (
            <span className="absolute bottom-2 right-12 text-xs text-gray-400">
              {2000 - value.length}
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!value.trim() || isLoading}
          className={`
            flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center
            transition-all duration-200
            ${value.trim() && !isLoading
              ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
})

export default ChatInput
