import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import TasksPage from './pages/TasksPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/" element={<Navigate to="/tasks" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
