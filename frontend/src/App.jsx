import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Login from './pages/login.jsx'
import Dashboard from './pages/dashboard.jsx'
import Incidents from './pages/incidents.jsx'
import ManageUsers from './pages/ManageUsers.jsx'
import Sidebar from './components/sidebar.jsx'
function App() {
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
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={handleLogout} collapsed={!sidebarOpen}
               onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/incidents" element={<Incidents user={user} />} />
          <Route path="/manage-users" element={<ManageUsers user={user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}
export default App