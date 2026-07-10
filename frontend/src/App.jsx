/**
 * App.jsx - Root component with routing and global providers.
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import ChatPage from './pages/ChatPage'

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProvider>
  )
}
