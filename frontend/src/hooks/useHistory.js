import { useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { getSessions, getHistory, deleteHistory } from '../services/api'
import toast from 'react-hot-toast'

export function useHistory() {
  const { state, dispatch } = useApp()

  const fetchSessions = useCallback(async () => {
    try {
      const data = await getSessions()
      dispatch({ type: 'SET_SESSIONS', payload: data.sessions })
    } catch {
      // silently fail — history panel is non-critical
    }
  }, [dispatch])

  const loadSession = useCallback(async (sessionId) => {
    try {
      const data = await getHistory(sessionId)
      const messages = []
      let lastUserQuestion = ''

      data.messages.forEach((m, i) => {
        if (m._title) return

        const nextMessage = {
          id: i,
          role: m.role,
          content: m.content,
          sources: [],
          streaming: false,
        }

        if (m.role === 'user') {
          lastUserQuestion = m.content
        } else if (m.role === 'assistant') {
          nextMessage._prevQuestion = lastUserQuestion
        }

        messages.push(nextMessage)
      })

      dispatch({ type: 'LOAD_SESSION', payload: { sessionId, messages } })
    } catch {
      toast.error('Failed to load chat session')
    }
  }, [dispatch])

  const removeSession = useCallback(async (sessionId) => {
    try {
      await deleteHistory(sessionId)
      dispatch({ type: 'DELETE_SESSION', payload: sessionId })
      toast.success('Chat deleted')
    } catch {
      toast.error('Failed to delete chat')
    }
  }, [dispatch])

  const newChat = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' })
  }, [dispatch])

  return {
    sessions: state.sessions,
    currentSessionId: state.sessionId,
    fetchSessions,
    loadSession,
    removeSession,
    newChat,
  }
}
