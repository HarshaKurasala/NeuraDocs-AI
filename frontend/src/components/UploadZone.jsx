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
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200
          ${isDragActive
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
          }
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-2 text-gray-400 dark:text-gray-500" size={28} />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isDragActive ? 'Drop files here...' : 'Drag & drop PDFs or Word docs, or click to browse'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF, DOCX · Max 20MB per file</p>
      </div>

      {/* Pending files list */}
      <AnimatePresence>
        {pendingFiles.map((file) => (
          <motion.div
            key={file.name}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
          >
            <FileText size={16} className="text-primary-500 flex-shrink-0" />
            <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
              {file.name}
            </span>
            <span className="text-xs text-gray-400">
              {(file.size / 1024 / 1024).toFixed(1)}MB
            </span>
            <button
              onClick={() => removeFile(file.name)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Upload progress */}
      {uploadState === 'uploading' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Uploading & indexing...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <motion.div
              className="bg-primary-500 h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Status messages */}
      {uploadState === 'success' && (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
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
          className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Upload {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
