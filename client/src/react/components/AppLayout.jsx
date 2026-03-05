import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function NavItem({ to, label, icon, active }) {
  const base = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors';
  const activeClass = `${base} font-semibold bg-[#F0654D] text-white`;
  const inactiveClass = `${base} font-medium text-gray-600 hover:bg-white/60 hover:text-gray-800`;
  return (
    <Link to={to} className={active ? activeClass : inactiveClass}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

// ── SVG icons ──────────────────────────────────────────────────────────────────

const icons = {
  tasks: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2.5" width="14" height="2" rx="1" fill="currentColor" />
      <rect x="1" y="7" width="10" height="2" rx="1" fill="currentColor" />
      <rect x="1" y="11.5" width="12" height="2" rx="1" fill="currentColor" />
    </svg>
  ),
  myTasks: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  departments: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="8" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6" y="5" width="4" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 13c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 7c1.105 0 2 .895 2 2M13 7a3 3 0 010 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  audit: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 5h4M6 8h4M6 11h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  logout: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ── Section label ──────────────────────────────────────────────────────────────

function SectionLabel({ label }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mt-1 mb-1">{label}</p>;
}

// ── AppLayout ──────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const { user, setUser } = useAuth();
  const navigate           = useNavigate();
  const location           = useLocation();
  const [searchParams]     = useSearchParams();
  const [signingOut, setSigningOut] = useState(false);

  const initials = user ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';

  const isMine    = location.pathname === '/tasks' && searchParams.get('scope') === 'mine';
  const isTasks   = location.pathname === '/tasks' && !isMine;
  const isDepts   = location.pathname === '/departments';
  const isUsers   = location.pathname === '/admin/users';
  const isAudit   = location.pathname === '/admin/audit';
  const isProfile = location.pathname === '/profile';
  const isSettings = location.pathname === '/settings';

  async function handleLogout() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
      navigate('/login');
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#F6F7F9] grid grid-cols-[260px_1fr]">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="bg-[#F5EDE6] flex flex-col p-5 gap-4 overflow-y-auto">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 bg-[#F0654D] rounded-lg flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2.5"  width="14" height="2" rx="1" fill="white" />
              <rect x="1" y="7"    width="10" height="2" rx="1" fill="white" />
              <rect x="1" y="11.5" width="12" height="2" rx="1" fill="white" />
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-800 tracking-tight">TaskFlow</span>
        </div>

        {/* User card */}
        <div className="flex items-center gap-3 p-3 bg-white/60 rounded-2xl">
          <div className="w-9 h-9 bg-[#F0654D] rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.role}</p>
          </div>
        </div>

        {/* Workspace nav */}
        <nav className="flex flex-col gap-0.5">
          <SectionLabel label="Workspace" />
          <NavItem to="/tasks"             label="Tasks"       icon={icons.tasks}       active={isTasks} />
          <NavItem to="/tasks?scope=mine"  label="My Tasks"    icon={icons.myTasks}     active={isMine} />
          <NavItem to="/departments"       label="Departments" icon={icons.departments} active={isDepts} />
        </nav>

        {/* Admin nav — ADMIN only */}
        {user?.role === 'ADMIN' && (
          <nav className="flex flex-col gap-0.5">
            <SectionLabel label="Admin" />
            <NavItem to="/admin/users" label="Users"      icon={icons.users} active={isUsers} />
            <NavItem to="/admin/audit" label="Audit Logs" icon={icons.audit} active={isAudit} />
          </nav>
        )}

        <div className="flex-1" />

        {/* Account nav */}
        <nav className="flex flex-col gap-0.5">
          <SectionLabel label="Account" />
          <NavItem to="/profile"  label="Profile"  icon={icons.profile}  active={isProfile} />
          <NavItem to="/settings" label="Settings" icon={icons.settings} active={isSettings} />
        </nav>

        {/* Log out */}
        <button
          onClick={handleLogout}
          disabled={signingOut}
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-[#F0654D] hover:bg-white/60 rounded-xl transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {icons.logout}
          {signingOut ? 'Signing out…' : 'Log Out'}
        </button>

      </aside>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <Outlet />

    </div>
  );
}
