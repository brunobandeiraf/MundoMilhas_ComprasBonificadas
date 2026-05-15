import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Header from './components/Header'
import LoginPage from './pages/LoginPage'
import ActivationPage from './pages/ActivationPage'
import StoresPage from './pages/StoresPage'
import AdminPage from './pages/AdminPage'
import type { ReactNode } from 'react'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div className="page-loading">Carregando...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return <div className="page-loading">Carregando...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin()) {
    return <Navigate to="/stores" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div className="page-loading">Carregando...</div>
  }

  if (isAuthenticated) {
    return <Navigate to="/stores" replace />
  }

  return <>{children}</>
}

function AppLayout() {
  return (
    <>
      <Header />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route path="/activation" element={<ActivationPage />} />
        <Route
          path="/stores"
          element={
            <ProtectedRoute>
              <StoresPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route path="/" element={<Navigate to="/stores" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  )
}
