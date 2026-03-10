import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider }   from './context/AuthContext.jsx';
import { ToastProvider }  from './context/ToastContext.jsx';
import ProtectedRoute     from './components/ProtectedRoute.jsx';
import AppLayout          from './components/AppLayout.jsx';
import AuthLayout         from './components/AuthLayout.jsx';
import LoginPage           from './pages/LoginPage.jsx';
import ForgotPasswordPage  from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage   from './pages/ResetPasswordPage.jsx';
import PendingApprovalPage from './pages/PendingApprovalPage.jsx';
import AccessRequestsPage  from './pages/AccessRequestsPage.jsx';
import TasksPage          from './pages/TasksPage.jsx';
import DepartmentsPage    from './pages/DepartmentsPage.jsx';
import ProfilePage        from './pages/ProfilePage.jsx';
import UsersPage          from './pages/admin/UsersPage.jsx';
import AuditPage          from './pages/admin/AuditPage.jsx';
import ReportsPage        from './pages/admin/ReportsPage.jsx';
import DashboardPage      from './pages/DashboardPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login"            element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password"  element={<ResetPasswordPage />} />
            <Route path="/pending-approval" element={<PendingApprovalPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard"   element={<DashboardPage />} />
              <Route path="/tasks"       element={<TasksPage />} />
              <Route path="/departments" element={<DepartmentsPage />} />
              <Route path="/profile"     element={<ProfilePage />} />
              <Route path="/settings"    element={<Navigate to="/profile" replace />} />
              <Route element={<ProtectedRoute roles={['ADMIN', 'SUPER']} />}>
                <Route path="/requests" element={<AccessRequestsPage />} />
              </Route>

              <Route element={<ProtectedRoute role="ADMIN" />}>
                <Route path="/admin/users"    element={<UsersPage />} />
                <Route path="/admin/audit"    element={<AuditPage />} />
                <Route path="/admin/reports"  element={<ReportsPage />} />
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
