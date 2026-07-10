/**
 * components/UploadZone.jsx - Drag-and-drop PDF upload component.
 *
 * Uses react-dropzone for drag-and-drop support.
 * Shows upload progress and validates file types client-side.
 */

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react'
import { useDocuments } from '../hooks/useDocuments'

export default function UploadZone() {
  const { upload } = useDocuments()
  const [uploadState, setUploadState] = useState('idle')  // idle | uploading | success | error
  const [progress, setProgress] = useState(0)
  const [pendingFiles, setPendingFiles] = useState([])

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      setUploadState('error')
      setTimeout(() => setUploadState('idle'), 3000)
      return
    }
    setPendingFiles(acceptedFiles)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'text/csv': ['.csv'],
    },
    maxSize: 20 * 1024 * 1024,   // 20MB
    multiple: true,
  })

  const handleUpload = async () => {
    if (!pendingFiles.length) return
    setUploadState('uploading')
    setProgress(0)
    try {
      await upload(pendingFiles, setProgress)
      setUploadState('success')
      setPendingFiles([])
      setTimeout(() => setUploadState('idle'), 2000)
    } catch {
      setUploadState('error')
      setTimeout(() => setUploadState('idle'), 3000)
    }
  }

  const removeFile = (name) =>
    setPendingFiles((prev) => prev.filter((f) => f.name !== name))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">Ingestion</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Add source documents</h3>
        </div>
        <span className="rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-950/50 px-3 py-1 text-[11px] text-slate-500 dark:text-slate-400">
          PDF · DOCX · 20MB
        </span>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-[26px] p-6 text-center cursor-pointer transition-all duration-200 shadow-sm
          ${isDragActive
            ? 'border-primary-500 bg-primary-50/80 dark:bg-primary-900/20'
            : 'border-slate-300/80 dark:border-slate-700/80 hover:border-primary-400 dark:hover:border-primary-500'
          }
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-3 text-primary-500" size={30} />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {isDragActive ? 'Drop files here...' : 'Drag & drop PDFs or Word docs, or click to browse'}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Structured extraction, chunking, and indexing start automatically after upload.</p>
      </div>

      {/* Pending files list */}
      <AnimatePresence>
        {pendingFiles.map((file) => (
          <motion.div
            key={file.name}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-center gap-2 bg-white/80 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl px-3 py-2.5"
          >
            <FileText size={16} className="text-primary-500 flex-shrink-0" />
            <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1">
              {file.name}
            </span>
            <span className="text-xs text-slate-400">
              {(file.size / 1024 / 1024).toFixed(1)}MB
            </span>
            <button
              onClick={() => removeFile(file.name)}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Upload progress */}
      {uploadState === 'uploading' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Uploading & indexing...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-primary-600 to-cyan-500 h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Status messages */}
      {uploadState === 'success' && (
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
          <CheckCircle size={16} />
          <span>Documents indexed successfully!</span>
        </div>
      )}
      {uploadState === 'error' && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle size={16} />
          <span>Upload failed. Check file format and size.</span>
        </div>
      )}

      {/* Upload button */}
      {pendingFiles.length > 0 && uploadState === 'idle' && (
        <button
          onClick={handleUpload}
          className="w-full py-3 bg-gradient-to-r from-primary-600 to-cyan-500 hover:from-primary-700 hover:to-cyan-600 text-white text-sm font-semibold rounded-2xl transition-all shadow-lg shadow-primary-600/20"
        >
          Upload {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
