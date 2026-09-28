import { Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.tsx'
import LoginPage from './pages/LoginPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import PcPage from './pages/PcPage.tsx'
import AccountsPage from './pages/AccountsPage.tsx'
import TransactionsPage from './pages/TransactionsPage.tsx'
import ReportsPage from './pages/ReportsPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import Layout from './components/Layout.tsx'

function App() {
  const { token } = useAuth()

  if (!token) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/pcs" element={<PcPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App