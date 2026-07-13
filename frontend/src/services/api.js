/**
 * services/api.js - Centralized Axios API layer.
 *
 * WHY A DEDICATED API LAYER?
 * - Single place to configure base URL, headers, interceptors
 * - Components never hardcode URLs — they call service functions
 * - Easy to swap backend URL for production vs development
 * - Interceptors handle auth tokens and error logging globally
 */

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // 60s for large PDF uploads
})

// ── Request interceptor: attach auth token if present ────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor: normalize errors ───────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.message ||
      'An unexpected error occurred'
    return Promise.reject(new Error(message))
  }
)

// ── Upload API ────────────────────────────────────────────────────────────────

/**
 * Upload one or more PDF files.
 * @param {File[]} files - Array of File objects from the file input
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<Array>} Array of UploadResponse objects
 */
export const uploadDocuments = async (files, onProgress) => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total))
      }
    },
  })
  return response.data
}

// ── Chat API (non-streaming) ──────────────────────────────────────────────────

/**
 * Send a chat message and get a full JSON response.
 * Used as fallback when streaming is not available.
 */
export const sendChatMessage = async (question, sessionId, documentIds = []) => {
  const response = await api.post('/chat', {
    question,
    session_id: sessionId,
    document_ids: documentIds,
    stream: false,
  })
  return response.data
}

// ── History API ───────────────────────────────────────────────────────────────

export const getHistory = async (sessionId) => {
  const response = await api.get(`/history/${sessionId}`)
  return response.data
}

export const deleteHistory = async (sessionId) => {
  await api.delete(`/history/${sessionId}`)
}

export const getSessions = async () => {
  const response = await api.get('/sessions')
  return response.data
}

// ── Documents API ─────────────────────────────────────────────────────────────

export const listDocuments = async () => {
  const response = await api.get('/documents')
  return response.data
}

export const deleteDocument = async (documentId) => {
  await api.delete(`/documents/${documentId}`)
}

// ── Streaming chat (SSE via fetch) ────────────────────────────────────────────

/**
 * Streaming chat using the Fetch API + ReadableStream.
 * Axios doesn't support SSE streaming, so we use native fetch here.
 *
 * SSE format from backend:
 *   data: <token>\n\n
 *   data: [SOURCES]<json>\n\n
 *   data: [DONE]\n\n
 *
 * @param {string} question
 * @param {string} sessionId
 * @param {string[]} documentIds
 * @param {Function} onToken - Called with each text token
 * @param {Function} onSources - Called with the sources array when complete
 * @param {Function} onDone - Called when stream ends
 * @param {Function} onError - Called on error
 */
export const streamChat = async (
  question,
  sessionId,
  documentIds,
  onToken,
  onSources,
  onDone,
  onError
) => {
  const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/chat`

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        session_id: sessionId,
        document_ids: documentIds,
        stream: true,
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.detail || 'Chat request failed')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    // Important: SSE frames can be split across multiple reads.
    // Buffer and only parse complete `data:` events separated by blank lines.
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse complete SSE events (separated by blank line)
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      for (const part of parts) {
        // Each event can have multiple `data:` lines; join them with \n.
        const dataLines = part
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('data:'))

        if (dataLines.length === 0) continue

        const data = dataLines
          .map((l) => l.slice('data:'.length).trimStart())
          .join('\n')

        if (data === '[DONE]') {
          onDone()
          return
        }

        if (data.startsWith('[ERROR]')) {
          onError(new Error(data.slice('[ERROR]'.length)))
          return
        }

        if (data.startsWith('[SOURCES]')) {
          try {
            const sources = JSON.parse(data.slice('[SOURCES]'.length))
            onSources(sources)
          } catch {
            // ignore parse errors on sources
          }
          continue
        }

        // Regular token — unescape newlines that backend encoded as "\\n"
        onToken(data.replace(/\\n/g, '\n'))
      }
    }
  } catch (err) {
    onError(err)
  }
}

export default api

