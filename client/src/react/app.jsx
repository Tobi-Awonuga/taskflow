import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider }   from './context/AuthContext.jsx';
import ProtectedRoute     from './components/ProtectedRoute.jsx';
import AppLayout          from './components/AppLayout.jsx';
import LoginPage          from './pages/LoginPage.jsx';
import TasksPage          from './pages/TasksPage.jsx';
import DepartmentsPage    from './pages/DepartmentsPage.jsx';
import ProfilePage        from './pages/ProfilePage.jsx';
import SettingsPage       from './pages/SettingsPage.jsx';
import UsersPage          from './pages/admin/UsersPage.jsx';
import AuditPage          from './pages/admin/AuditPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/tasks"       element={<TasksPage />} />
              <Route path="/departments" element={<DepartmentsPage />} />
              <Route path="/profile"     element={<ProfilePage />} />
              <Route path="/settings"    element={<SettingsPage />} />

              <Route element={<ProtectedRoute role="ADMIN" />}>
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/audit" element={<AuditPage />} />
              </Route>

              <Route path="/" element={<Navigate to="/tasks" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
