import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Moon, Sun, Trash2, Cpu, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { useChat } from '../hooks/useChat'

function ConfirmModal({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 20 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed z-[9999] inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-[360px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-red-400 to-red-600" />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-900/25 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={20} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Clear Conversation</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">This action is permanent</p>
                  </div>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800 my-4" />
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  All messages in this conversation will be permanently removed. Your uploaded documents will remain intact.
                </p>
                <div className="border-t border-gray-100 dark:border-gray-800 my-4" />
                <div className="flex gap-3">
                  <button
                    onClick={onCancel}
                    className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Keep it
                  </button>
                  <button
                    onClick={onConfirm}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-colors shadow-sm"
                  >
                    Yes, Clear
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default function Navbar() {
  const { state, dispatch } = useApp()
  const { clearChat } = useChat()
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <>
      <ConfirmModal
        isOpen={showConfirm}
        onConfirm={() => { clearChat(); setShowConfirm(false) }}
        onCancel={() => setShowConfirm(false)}
      />

      <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Cpu size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-none">
              NeuraDocs
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-none mt-0.5">
              Document Intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfirm(true)}
            title="Clear conversation"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-500 transition-colors"
          >
            <Trash2 size={18} />
          </button>

          <button
            onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
            title="Toggle dark mode"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {state.isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
    </>
  )
}
