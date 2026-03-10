import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// ── Nav item ───────────────────────────────────────────────────────────────────

function NavItem({ to, label, icon, active, dots }) {
  const base = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150';
  const activeClass   = `${base} font-semibold bg-[#F0654D] text-white shadow-sm`;
  const inactiveClass = `${base} font-medium text-gray-500 hover:bg-white/70 hover:text-gray-900`;
  return (
    <Link to={to} className={active ? activeClass : inactiveClass}>
      {icon}
      <span className="flex-1">{label}</span>
      {dots && dots.length > 0 && (
        <span className="flex items-center gap-0.5">
          {dots.map((color, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: active ? 'rgba(255,255,255,0.8)' : color }}
            />
          ))}
        </span>
      )}
    </Link>
  );
}

// ── SVG icons ──────────────────────────────────────────────────────────────────

const icons = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
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
  reports: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 12V8M6 12V4M10 12V6M14 12V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
  return (
    <p className="text-[10px] font-semibold text-gray-400/70 uppercase tracking-widest px-1 pt-2 pb-1">
      {label}
    </p>
  );
}

// ── Role pill ──────────────────────────────────────────────────────────────────

const ROLE_STYLE = {
  ADMIN: { dot: '#9333ea', text: 'text-purple-700', bg: 'bg-purple-100' },
  SUPER: { dot: '#3b82f6', text: 'text-blue-700',   bg: 'bg-blue-100'   },
  USER:  { dot: '#6b7280', text: 'text-gray-500',   bg: 'bg-gray-100'   },
};

function RolePill({ role }) {
  const s = ROLE_STYLE[role] || ROLE_STYLE.USER;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
      {role}
    </span>
  );
}

// ── AppLayout ──────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const { user, setUser } = useAuth();
  const navigate           = useNavigate();
  const location           = useLocation();
  const [searchParams]     = useSearchParams();
  const [signingOut, setSigningOut] = useState(false);
  const [myStats, setMyStats] = useState({ todo: 0, inProgress: 0, blocked: 0, overdue: 0 });

  useEffect(() => {
    if (!user) return;
    function fetchStats() {
      fetch(`/api/tasks/stats?assignedToUserId=${user.id}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setMyStats(d))
        .catch(() => {});
    }
    fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const myTaskDots = [
    myStats.todo       > 0 ? '#4C8DFF' : null,
    myStats.inProgress > 0 ? '#F4A23A' : null,
    (myStats.blocked > 0 || myStats.overdue > 0) ? '#F05A5A' : null,
  ].filter(Boolean);

  const initials = user ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';

  const isDashboard = location.pathname === '/dashboard';
  const isMine      = location.pathname === '/tasks' && searchParams.get('scope') === 'mine';
  const isTasks     = location.pathname === '/tasks' && !isMine;
  const isDepts     = location.pathname === '/departments';
  const isUsers     = location.pathname === '/admin/users';
  const isAudit     = location.pathname === '/admin/audit';
  const isReports   = location.pathname === '/admin/reports';
  const isProfile   = location.pathname === '/profile';

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
      <aside className="bg-[#F5EDE6] border-r border-black/[0.06] flex flex-col overflow-y-auto">

        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-black/[0.06]">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-[#F0654D] rounded-lg flex items-center justify-center shrink-0 group-hover:bg-[#E85B44] transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="2.5"  width="14" height="2" rx="1" fill="white" />
                <rect x="1" y="7"    width="10" height="2" rx="1" fill="white" />
                <rect x="1" y="11.5" width="12" height="2" rx="1" fill="white" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-800 tracking-tight">Nectar</span>
          </Link>
        </div>

        {/* Nav */}
        <div className="flex flex-col flex-1 px-4 py-3 gap-0.5">

          {/* Workspace nav */}
          <SectionLabel label="Workspace" />
          <NavItem to="/dashboard"         label="Dashboard"   icon={icons.dashboard}   active={isDashboard} />
          <NavItem to="/tasks"             label="All Tasks"   icon={icons.tasks}       active={isTasks} />
          <NavItem to="/tasks?scope=mine"  label="My Tasks"    icon={icons.myTasks}     active={isMine} dots={myTaskDots} />
          <NavItem to="/departments"       label="Departments" icon={icons.departments} active={isDepts} />

          {/* Admin nav — ADMIN only */}
          {user?.role === 'ADMIN' && (
            <>
              <SectionLabel label="Admin" />
              <NavItem to="/admin/users"    label="Users"      icon={icons.users}    active={isUsers} />
              <NavItem to="/admin/audit"   label="Audit Logs" icon={icons.audit}    active={isAudit} />
              <NavItem to="/admin/reports" label="Reports"    icon={icons.reports}  active={isReports} />
            </>
          )}

          <div className="flex-1" />

          {/* Account nav */}
          <SectionLabel label="Account" />
          <NavItem to="/profile"  label="Profile"  icon={icons.profile}  active={isProfile} />

          {/* Log out */}
          <button
            onClick={handleLogout}
            disabled={signingOut}
            className="mt-1 flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-white/60 rounded-xl transition-all duration-150 w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {icons.logout}
            {signingOut ? 'Signing out…' : 'Log out'}
          </button>

        </div>

        {/* User card — pinned at bottom */}
        <div className="px-4 py-4 border-t border-black/[0.06]">
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-black/[0.05]">
            <div className="w-9 h-9 bg-[#F0654D] rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
              <div className="mt-0.5">
                <RolePill role={user?.role} />
              </div>
            </div>
          </div>
        </div>

      </aside>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <Outlet />

    </div>
  );
}
