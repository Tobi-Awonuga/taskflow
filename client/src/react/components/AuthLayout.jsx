import { useLocation, Outlet } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';

/**
 * Route wrapper for all auth pages (login, forgot-password, reset-password).
 *
 * AuthShell (video backdrop) mounts ONCE and stays alive across transitions.
 * Only the inner card content re-renders, with a subtle fade-in per route.
 */
export default function AuthLayout() {
  const { pathname } = useLocation();

  return (
    <AuthShell>
      <div
        key={pathname}
        style={{ animation: 'card-fade-in 0.22s ease both' }}
      >
        <Outlet />
      </div>
    </AuthShell>
  );
}
