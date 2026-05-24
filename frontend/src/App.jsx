import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, lazy, Suspense } from 'react'
import Login from './pages/Login.jsx'
import Sidebar from './components/Sidebar.jsx'
import { cn } from './lib/cn'
import { isAdmin } from './lib/roles'

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Incidents = lazy(() => import('./pages/Incidents.jsx'))
const ManageUsers = lazy(() => import('./pages/ManageUsers.jsx'))
const ActivityLog = lazy(() => import('./pages/ActivityLog.jsx'))

function AdminRoute({ user, children }) {
  return isAdmin(user) ? children : <Navigate to="/" replace />
}

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )
}

/** Root App: auth state, routing, sidebar layout */
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'))
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setToken(token)
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser({})
  }

  if (!token) return <Login onLogin={handleLogin} />

  return (
    <div className={cn('flex h-screen', 'bg-gray-50')}>
      <Sidebar
        user={user}
        onLogout={handleLogout}
        collapsed={!sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <main className="flex-1 overflow-auto">
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/incidents" element={<Incidents key="all" user={user} />} />
            <Route path="/assigned-incidents" element={<Incidents key="assigned" user={user} myIncidents />} />
            <Route path="/manage-users" element={
              <AdminRoute user={user}>
                <ManageUsers user={user} />
              </AdminRoute>
            } />
            <Route path="/activity-log" element={
              <AdminRoute user={user}>
                <ActivityLog />
              </AdminRoute>
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
