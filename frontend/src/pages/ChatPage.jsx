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
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Chat area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin">
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
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mb-4">
        <MessageSquare size={32} className="text-primary-600 dark:text-primary-400" />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
        {hasDocuments ? 'Ready to answer questions' : 'Upload documents to get started'}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
        {hasDocuments
          ? 'Ask anything about your uploaded documents. I\'ll find the most relevant information and cite my sources.'
          : 'Upload one or more PDF or Word files using the sidebar. I\'ll extract, index, and make them searchable instantly.'}
      </p>
      {hasDocuments && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
          {[
            'Summarize the main points',
            'What are the key findings?',
            'Explain the methodology',
            'List all recommendations',
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSuggestion(suggestion)}
              className="text-left px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
