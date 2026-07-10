/**
 * pages/ChatPage.jsx - Main chat interface page.
 *
 * Layout:
 *   Navbar (top)
 *   ├── Sidebar (left) — document list + upload
 *   └── Chat area (right)
 *       ├── Message list (scrollable)
 *       └── Input bar (bottom)
 */

import { useEffect, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import MessageBubble from '../components/MessageBubble'
import ChatInput from '../components/ChatInput'
import { useChat } from '../hooks/useChat'
import { useApp } from '../context/AppContext'

export default function ChatPage() {
  const { messages, sendMessage, resendFromIndex, isLoading } = useChat()
  const { state } = useApp()
  const bottomRef = useRef(null)
  const chatInputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSuggestion = useCallback((text) => {
    chatInputRef.current?.setValue(text)
  }, [])

  return (
    <div className="relative flex flex-col h-screen overflow-hidden text-slate-900 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-grid-dots opacity-[0.35] dark:opacity-[0.12]" />
      <div className="pointer-events-none absolute -top-24 left-16 h-72 w-72 rounded-full bg-primary-500/10 blur-3xl animate-float" />
      <div className="pointer-events-none absolute top-1/3 right-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl animate-float" style={{ animationDelay: '1.6s' }} />

      <Navbar />

      <div className="relative z-10 flex flex-1 gap-4 overflow-hidden p-4 lg:p-5">
        <Sidebar />

        {/* Chat area */}
        <main className="flex-1 flex flex-col overflow-hidden glass-panel rounded-[28px]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-950/50 backdrop-blur-xl rounded-t-[28px]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-400 dark:text-slate-500">Workspace</p>
              <h2 className="mt-1 text-lg font-display font-bold text-slate-900 dark:text-slate-50">Conversational document intelligence</h2>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
              Live session · {state.documents.length} documents indexed
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 scrollbar-thin">
            {messages.length === 0 ? (
              <EmptyState hasDocuments={state.documents.length > 0} onSuggestion={handleSuggestion} />
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg, index) => (
                  <MessageBubble key={msg.id} message={msg} index={index} onResend={resendFromIndex} isLoading={isLoading} />
                ))}
              </AnimatePresence>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <ChatInput ref={chatInputRef} onSend={sendMessage} isLoading={isLoading} />
        </main>
      </div>
    </div>
  )
}

function EmptyState({ hasDocuments, onSuggestion }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-10">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-[28px] bg-primary-500/10 blur-xl" />
        <div className="relative w-16 h-16 rounded-[24px] bg-gradient-to-br from-primary-600 to-cyan-500 flex items-center justify-center shadow-lg">
          <MessageSquare size={30} className="text-white" />
        </div>
      </div>
      <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mb-3">
        {hasDocuments ? 'Ready to answer questions' : 'Upload documents to get started'}
      </h2>
      <p className="text-sm leading-6 text-slate-500 dark:text-slate-400 max-w-xl">
        {hasDocuments
          ? 'Ask anything about your uploaded documents. I\'ll find the most relevant information and cite my sources.'
          : 'Upload one or more PDF or Word files using the sidebar. I\'ll extract, index, and make them searchable instantly.'}
      </p>
      {hasDocuments && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
          {[
            'Summarize the main points',
            'What are the key findings?',
            'Explain the methodology',
            'List all recommendations',
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSuggestion(suggestion)}
              className="group text-left px-4 py-3 glass-panel rounded-2xl text-sm text-slate-600 dark:text-slate-300 hover:border-primary-300 dark:hover:border-primary-500/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
