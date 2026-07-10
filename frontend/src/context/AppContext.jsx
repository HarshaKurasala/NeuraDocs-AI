/**
 * context/AppContext.jsx - Global state management using React Context + useReducer.
 *
 * WHY CONTEXT?
 * Multiple components need access to the same state:
 *   - Uploaded documents list (Sidebar + Chat)
 *   - Chat messages (ChatWindow + MessageList)
 *   - Dark mode preference (entire app)
 *   - Active session ID (Chat + History)
 *
 * useReducer gives us predictable state transitions (like Redux, but built-in).
 */

import { createContext, useContext, useReducer, useEffect } from 'react'

const AppContext = createContext(null)

// ── Initial state ─────────────────────────────────────────────────────────────
const initialState = {
  documents: [],
  messages: [],
  sessionId: `session_${Date.now()}`,
  sessions: [],           // list of past chat sessions for history panel
  isLoading: false,
  isDarkMode: localStorage.getItem('darkMode') === 'true',
  selectedDocIds: [],
  streamingMessageId: null,
}

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'ADD_DOCUMENTS':
      return {
        ...state,
        documents: [...state.documents, ...action.payload],
      }

    case 'SET_DOCUMENTS':
      return { ...state, documents: action.payload }

    case 'REMOVE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.filter((d) => d.document_id !== action.payload),
        selectedDocIds: state.selectedDocIds.filter((id) => id !== action.payload),
      }

    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] }

    case 'APPEND_TOKEN': {
      // Append a streaming token to the last assistant message
      const msgs = [...state.messages]
      const lastIdx = msgs.length - 1
      if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
        msgs[lastIdx] = {
          ...msgs[lastIdx],
          content: msgs[lastIdx].content + action.payload,
        }
      }
      return { ...state, messages: msgs }
    }

    case 'SET_MESSAGE_SOURCES': {
      const msgs = [...state.messages]
      const lastIdx = msgs.length - 1
      if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
        msgs[lastIdx] = { ...msgs[lastIdx], sources: action.payload, streaming: false }
      }
      return { ...state, messages: msgs, streamingMessageId: null }
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }

    case 'SET_STREAMING_ID':
      return { ...state, streamingMessageId: action.payload }

    case 'TOGGLE_DARK_MODE':
      return { ...state, isDarkMode: !state.isDarkMode }

    case 'TOGGLE_DOC_SELECTION': {
      const id = action.payload
      const selected = state.selectedDocIds.includes(id)
        ? state.selectedDocIds.filter((d) => d !== id)
        : [...state.selectedDocIds, id]
      return { ...state, selectedDocIds: selected }
    }

    case 'EDIT_MESSAGE': {
      // Truncate all messages from the edited index onward, update the question
      const msgs = state.messages.slice(0, action.payload.index)
      msgs.push({ ...state.messages[action.payload.index], content: action.payload.content })
      return { ...state, messages: msgs, sessionId: `session_${Date.now()}` }
    }

    case 'CLEAR_MESSAGES':
      return { ...state, messages: [], sessionId: `session_${Date.now()}` }

    case 'SET_HISTORY':
      return { ...state, messages: action.payload }

    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload }

    case 'LOAD_SESSION':
      return {
        ...state,
        sessionId: action.payload.sessionId,
        messages: action.payload.messages,
      }

    case 'DELETE_SESSION':
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.session_id !== action.payload),
        // if deleting current session, start a new one
        ...(state.sessionId === action.payload
          ? { messages: [], sessionId: `session_${Date.now()}` }
          : {}),
      }

    default:
      return state
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Sync dark mode to <html> class and localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.isDarkMode)
    localStorage.setItem('darkMode', state.isDarkMode)
  }, [state.isDarkMode])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
