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

      <header className="relative z-20 mx-4 mt-4 rounded-[26px] glass-panel px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-primary-600/20">
              <Cpu size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-display font-bold tracking-wide text-slate-900 dark:text-slate-50 leading-none">
                NeuraDocs
              </h1>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500 leading-none mt-1">
                Document Intelligence Studio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
              Ready
            </div>

            <button
              onClick={() => setShowConfirm(true)}
              title="Clear conversation"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/60 transition-colors"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Clear</span>
            </button>

            <button
              onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
              title="Toggle dark mode"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
            >
              {state.isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              <span className="hidden sm:inline">Theme</span>
            </button>
          </div>
        </div>
      </header>
    </>
  )
}
