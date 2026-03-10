import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ role, roles } = {}) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;

  if (!user.isActive || user.approvalStatus !== 'APPROVED') {
    return <Navigate to="/pending-approval" replace />;
  }

  const allowedRoles = roles ?? (role ? [role] : null);
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/tasks" replace />;
  }

  return <Outlet />;
}
