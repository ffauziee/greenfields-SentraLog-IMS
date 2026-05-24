import { Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Incidents from './pages/Incidents.jsx'
import ManageUsers from './pages/ManageUsers.jsx'
import ActivityLog from './pages/ActivityLog.jsx'
import Sidebar from './components/Sidebar.jsx'
import { cn } from './lib/cn'
import { isAdmin } from './lib/roles'

function AdminRoute({ user, children }) {
  return isAdmin(user) ? children : <Navigate to="/" replace />
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
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/incidents" element={<Incidents key="all" user={user} />} />
          <Route path="/my-incidents" element={<Incidents key="mine" user={user} myIncidents />} />
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
      </main>
    </div>
  )
}
