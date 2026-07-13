import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, ChevronUp, FileText, User, Bot,
  Copy, Check, Pencil, RotateCcw, X, Send,
} from 'lucide-react'

export default function MessageBubble({ message, index, onResend, isLoading }) {
  const [showSources, setShowSources] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)
  const editRef = useRef(null)
  const isUser = message.role === 'user'
  const isStreaming = message.streaming

  useEffect(() => {
    if (isEditing) {
      editRef.current?.focus()
      const len = editRef.current?.value.length
      editRef.current?.setSelectionRange(len, len)
    }
  }, [isEditing])

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEditSubmit = () => {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === message.content) { setIsEditing(false); return }
    setIsEditing(false)
    onResend(index, trimmed)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSubmit() }
    if (e.key === 'Escape') { setIsEditing(false); setEditValue(message.content) }
  }

  const handleRegenerate = () => {
    // Prefer stored prev user question (set during streaming + history load), then fall back.
    const question = message._prevQuestion || message._question || editValue
    // Assistant message's "question" is the previous user message, but onResend() edits by index.
    // Use a stable fallback index for safety.
    const targetIndex = Math.max(0, index - 1)
    onResend(targetIndex, question)
  }


  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`group flex gap-3 px-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${
        isUser
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
      }`}>
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      {/* Bubble + actions */}
      <div className={`flex flex-col max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>

        {/* Edit mode for user messages */}
        {isUser && isEditing ? (
          <div className="w-full min-w-[280px]">
            <textarea
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className="w-full resize-none rounded-2xl border border-primary-400 px-4 py-3 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button
                onClick={() => { setIsEditing(false); setEditValue(message.content) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={12} /> Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50"
              >
                <Send size={12} /> Send
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Message bubble */}
            <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              isUser
                ? 'bg-primary-600 text-white rounded-tr-sm'
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm border border-gray-100 dark:border-gray-700'
            }`}>
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className={`prose prose-sm dark:prose-invert max-w-none ${isStreaming && !message.content ? 'min-h-[1.5rem]' : ''}`}>
                  {message.content ? (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                      {isStreaming && (
                        <span className="inline-block w-0.5 h-4 bg-gray-500 dark:bg-gray-400 ml-0.5 animate-pulse" />
                      )}
                    </>
                  ) : (
                    <TypingIndicator />
                  )}
                </div>
              )}
            </div>

            {/* Action buttons — appear on hover */}
            {!isStreaming && (
              <div className={`flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Copy */}
                <ActionBtn onClick={handleCopy} title="Copy">
                  {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                </ActionBtn>

                {/* Edit (user only) */}
                {isUser && !isLoading && (
                  <ActionBtn onClick={() => setIsEditing(true)} title="Edit message">
                    <Pencil size={13} />
                  </ActionBtn>
                )}

                {/* Regenerate (assistant only) */}
                {!isUser && !isLoading && (
                  <ActionBtn onClick={handleRegenerate} title="Regenerate response">
                    <RotateCcw size={13} />
                  </ActionBtn>
                )}
              </div>
            )}
          </>
        )}

        {/* Source citations */}
        {!isUser && !isEditing && message.sources && message.sources.length > 0 && (
          <div className="w-full mt-2">
            <button
              onClick={() => setShowSources((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <FileText size={12} />
              <span>{message.sources.length} source{message.sources.length > 1 ? 's' : ''}</span>
              {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-2 overflow-hidden"
                >
                  {message.sources.map((src, i) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <FileText size={12} className="text-primary-500 flex-shrink-0" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                          {src.filename}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                          Page {src.page_number}
                        </span>
                        <span className="ml-auto text-xs font-medium text-primary-600 dark:text-primary-400 flex-shrink-0">
                          {(src.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
                        {src.content}
                      </p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ActionBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      {children}
    </button>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full inline-block"
          style={{ animation: 'pulseDot 1.4s infinite ease-in-out', animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  )
}
