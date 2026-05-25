import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { SetupProvider } from './context/SetupContext'
import { ProtectedRoute, CompanyRequired, SystemAdminRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { CompanySelect } from './pages/CompanySelect'
import { Dashboard } from './pages/Dashboard'
import { Accounts } from './pages/Accounts'
import { Journal } from './pages/Journal'
import { Ledger } from './pages/Ledger'
import { Reports } from './pages/Reports'
import { BankReconciliation } from './pages/BankReconciliation'
import { Settings } from './pages/Settings'
import { Admin } from './pages/Admin'
import { NotFound } from './pages/NotFound'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/companies"
              element={
                <ProtectedRoute>
                  <CompanySelect />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <CompanyRequired>
                  <SetupProvider>
                    <Layout />
                  </SetupProvider>
                </CompanyRequired>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="journal" element={<Journal />} />
              <Route path="ledger" element={<Ledger />} />
              <Route path="reports" element={<Reports />} />
              <Route path="bank-reconciliation" element={<BankReconciliation />} />
              <Route path="settings" element={<Settings />} />
              <Route path="admin" element={<SystemAdminRoute><Admin /></SystemAdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
