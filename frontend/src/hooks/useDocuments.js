/**
 * hooks/useDocuments.js - Custom hook for document upload and management.
 */

import { useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { uploadDocuments, listDocuments, deleteDocument } from '../services/api'
import toast from 'react-hot-toast'

export function useDocuments() {
  const { state, dispatch } = useApp()

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await listDocuments()
      dispatch({ type: 'SET_DOCUMENTS', payload: data.documents })
    } catch (err) {
      toast.error('Failed to load documents')
    }
  }, [dispatch])

  const upload = useCallback(
    async (files, onProgress) => {
      try {
        const results = await uploadDocuments(files, onProgress)
        dispatch({ type: 'ADD_DOCUMENTS', payload: results })
        toast.success(`${results.length} document(s) uploaded successfully!`)
        return results
      } catch (err) {
        toast.error(err.message || 'Upload failed')
        throw err
      }
    },
    [dispatch]
  )

  const removeDocument = useCallback(
    async (documentId) => {
      try {
        await deleteDocument(documentId)
        dispatch({ type: 'REMOVE_DOCUMENT', payload: documentId })
        toast.success('Document removed')
      } catch (err) {
        toast.error('Failed to remove document')
      }
    },
    [dispatch]
  )

  const toggleSelection = useCallback(
    (documentId) => {
      dispatch({ type: 'TOGGLE_DOC_SELECTION', payload: documentId })
    },
    [dispatch]
  )

  return {
    documents: state.documents,
    selectedDocIds: state.selectedDocIds,
    fetchDocuments,
    upload,
    removeDocument,
    toggleSelection,
  }
}
