import { useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { streamChat, getSessions } from '../services/api'
import toast from 'react-hot-toast'

export function useChat() {
  const { state, dispatch } = useApp()

  const _stream = useCallback(async (question, sessionId) => {
    const assistantId = Date.now() + 1
    dispatch({
      type: 'ADD_MESSAGE',
      payload: { id: assistantId, role: 'assistant', content: '', sources: [], streaming: true, _prevQuestion: question },
    })
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_STREAMING_ID', payload: assistantId })

    await streamChat(
      question,
      sessionId,
      state.selectedDocIds,
      (token) => dispatch({ type: 'APPEND_TOKEN', payload: token }),
      (sources) => dispatch({ type: 'SET_MESSAGE_SOURCES', payload: sources }),
      async () => {
        dispatch({ type: 'SET_LOADING', payload: false })
        try {
          const data = await getSessions()
          dispatch({ type: 'SET_SESSIONS', payload: data.sessions })
        } catch {}
      },
      (err) => {
        dispatch({ type: 'SET_LOADING', payload: false })
        dispatch({ type: 'SET_STREAMING_ID', payload: null })
        toast.error(err.message || 'Chat failed. Please try again.')
      }
    )
  }, [state.selectedDocIds, dispatch])

  const sendMessage = useCallback(async (question) => {
    if (!question.trim() || state.isLoading) return
    dispatch({
      type: 'ADD_MESSAGE',
      payload: { id: Date.now(), role: 'user', content: question, sources: [] },
    })
    await _stream(question, state.sessionId)
  }, [state.isLoading, state.sessionId, _stream, dispatch])

  const resendFromIndex = useCallback(async (index, newQuestion) => {
    if (state.isLoading || !newQuestion?.trim()) return
    // Truncate messages from the edited index and re-ask
    dispatch({ type: 'EDIT_MESSAGE', payload: { index, content: newQuestion } })
    const newSessionId = `session_${Date.now()}`
    await _stream(newQuestion, newSessionId)
  }, [state.isLoading, _stream, dispatch])

  const clearChat = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' })
  }, [dispatch])

  return { sendMessage, resendFromIndex, clearChat, messages: state.messages, isLoading: state.isLoading }
}
