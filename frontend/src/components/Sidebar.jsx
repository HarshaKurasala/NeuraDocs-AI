import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Trash2, CheckSquare, Square, BookOpen,
  MessageSquare, Plus, AlertTriangle,
} from 'lucide-react'
import { useDocuments } from '../hooks/useDocuments'
import { useHistory } from '../hooks/useHistory'
import UploadZone from './UploadZone'

// ── Confirm Modal (rendered via Portal so it's always centered on screen) ─────

function ConfirmModal({ isOpen, title, subtitle, label, onConfirm, onCancel }) {
  if (!isOpen) return null
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={onCancel}
          />

          {/* Dialog — perfectly centered */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 20 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed z-[9999] inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-[360px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">

              {/* Top accent bar */}
              <div className="h-1 w-full bg-gradient-to-r from-red-400 to-red-600" />

              <div className="p-6">
                {/* Icon + title */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-900/25 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={20} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">This action is permanent</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100 dark:border-gray-800 my-4" />

                {/* Message */}
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-1">
                  {subtitle}
                </p>
                {label && (
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 mt-2 truncate">
                    📄 {label}
                  </p>
                )}

                {/* Divider */}
                <div className="border-t border-gray-100 dark:border-gray-800 my-4" />

                {/* Actions */}
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
                    Yes, Delete
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

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState('chats')
  const [confirm, setConfirm] = useState(null) // { title, message, onConfirm }

  const { documents, selectedDocIds, fetchDocuments, removeDocument, toggleSelection } = useDocuments()
  const { sessions, currentSessionId, fetchSessions, loadSession, removeSession, newChat } = useHistory()

  useEffect(() => { fetchDocuments() }, [fetchDocuments])
  useEffect(() => { fetchSessions() }, [fetchSessions])

  const askConfirm = (title, subtitle, label, onConfirm) => {
    setConfirm({ title, subtitle, label, onConfirm })
  }

  const handleConfirm = () => {
    confirm?.onConfirm()
    setConfirm(null)
  }

  return (
    <>
      <ConfirmModal
        isOpen={!!confirm}
        title={confirm?.title}
        subtitle={confirm?.subtitle}
        label={confirm?.label}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      <aside className="w-[340px] flex-shrink-0 h-full flex flex-col gap-4 overflow-hidden">

        <div className="glass-panel rounded-[28px] overflow-hidden flex flex-col h-full">

        {/* New Chat button */}
        <div className="p-4 border-b border-slate-200/70 dark:border-slate-800/70">
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-gradient-to-r from-primary-600 to-cyan-500 hover:from-primary-700 hover:to-cyan-600 text-white text-sm font-semibold rounded-2xl transition-all shadow-lg shadow-primary-600/20"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        {/* Tab switcher */}
        <div className="mx-4 mt-4 p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 flex">
          {[
            { id: 'chats', label: 'Chats', icon: MessageSquare },
            { id: 'docs', label: 'Documents', icon: BookOpen },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                activeTab === id
                  ? 'bg-white dark:bg-slate-950 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              {label}
              {id === 'docs' && documents.length > 0 && (
                <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full px-1.5 py-0.5 text-xs leading-none">
                  {documents.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden flex flex-col px-3 pb-3 pt-4">
          {activeTab === 'chats' ? (
            <ChatsPanel
              sessions={sessions}
              currentSessionId={currentSessionId}
              onLoad={loadSession}
              onDelete={(id, title) =>
                askConfirm(
                  'Delete Chat History',
                  'Deleting this chat will permanently remove all messages in this conversation. You won\'t be able to recover it.',
                  title,
                  () => removeSession(id)
                )
              }
              onRefresh={fetchSessions}
            />
          ) : (
            <DocsPanel
              documents={documents}
              selectedDocIds={selectedDocIds}
              onToggle={toggleSelection}
              onDelete={(id, filename) =>
                askConfirm(
                  'Remove Document',
                  'Removing this document will delete all its indexed content and embeddings. Any answers sourced from it will no longer be available.',
                  filename,
                  () => removeDocument(id)
                )
              }
            />
          )}
        </div>
        </div>
      </aside>
    </>
  )
}

// ── Chats Panel ───────────────────────────────────────────────────────────────

function ChatsPanel({ sessions, currentSessionId, onLoad, onDelete, onRefresh }) {
  useEffect(() => { onRefresh() }, [])

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center px-4 py-8 rounded-3xl border border-dashed border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-950/20">
        <MessageSquare size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No chat history yet</p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-[180px]">Start a conversation to see it here</p>
      </div>
    )
  }

  const grouped = groupByDate(sessions)

  return (
    <div className="flex-1 overflow-y-auto py-2 scrollbar-thin space-y-4">
      {Object.entries(grouped).map(([label, items]) => (
        <div key={label}>
          <p className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.28em]">
            {label}
          </p>
          <AnimatePresence>
            {items.map((session) => (
              <motion.div
                key={session.session_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className={`group relative flex items-center gap-2 mx-1 px-3 py-3 rounded-2xl cursor-pointer transition-all border ${
                  currentSessionId === session.session_id
                    ? 'bg-white dark:bg-slate-950 border-primary-200/80 dark:border-primary-800/80 shadow-sm'
                    : 'bg-white/40 dark:bg-slate-950/25 border-transparent hover:border-slate-200/80 dark:hover:border-slate-800/80 hover:shadow-sm'
                }`}
                onClick={() => onLoad(session.session_id)}
              >
                <MessageSquare size={14} className="flex-shrink-0 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs truncate ${
                    currentSessionId === session.session_id
                      ? 'text-primary-700 dark:text-primary-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {session.title}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {session.message_count} messages
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(session.session_id, session.title) }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

// ── Documents Panel ───────────────────────────────────────────────────────────

function DocsPanel({ documents, selectedDocIds, onToggle, onDelete }) {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col scrollbar-thin">
      <div className="p-3 rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white/50 dark:bg-slate-950/30">
        <UploadZone />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No documents yet</p>
          </div>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400 px-1">
              {selectedDocIds.length === 0
                ? 'Searching all documents'
                : `Searching ${selectedDocIds.length} selected`}
            </p>
            <AnimatePresence>
              {documents.map((doc) => {
                const isSelected = selectedDocIds.includes(doc.document_id)
                return (
                  <motion.div
                    key={doc.document_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`group flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-white dark:bg-slate-950 border-primary-200/80 dark:border-primary-800/80 shadow-sm'
                        : 'bg-white/45 dark:bg-slate-950/25 border-transparent hover:border-slate-200/80 dark:hover:border-slate-800/80 hover:shadow-sm'
                    }`}
                    onClick={() => onToggle(doc.document_id)}
                  >
                    <div className="mt-0.5 flex-shrink-0 text-primary-500">
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {doc.filename}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {doc.page_count} pages · {doc.chunk_count} chunks
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(doc.document_id, doc.filename) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByDate(sessions) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today - 86400000)
  const week = new Date(today - 7 * 86400000)
  const month = new Date(today - 30 * 86400000)

  const groups = { Today: [], Yesterday: [], 'Previous 7 Days': [], 'Previous 30 Days': [], Older: [] }

  sessions.forEach((s) => {
    const d = new Date(s.updated_at)
    if (d >= today) groups['Today'].push(s)
    else if (d >= yesterday) groups['Yesterday'].push(s)
    else if (d >= week) groups['Previous 7 Days'].push(s)
    else if (d >= month) groups['Previous 30 Days'].push(s)
    else groups['Older'].push(s)
  })

  return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length > 0))
}
