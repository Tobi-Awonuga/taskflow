import { useTasks }   from '../hooks/useTasks.js';
import ErrorBanner    from '../components/ErrorBanner.jsx';
import FiltersBar     from '../components/FiltersBar.jsx';
import TaskTable      from '../components/TaskTable.jsx';

// Still mocked — auth wiring is a separate sprint
const MOCK_USER = { name: 'Alex Johnson', role: 'SUPER', avatar: 'AJ', id: 1 };

// ── Small local components ─────────────────────────────────────────────────────

function NavItem({ label, active, count, onClick }) {
  const base = 'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors';
  return active ? (
    <button onClick={onClick} className={`${base} font-semibold bg-[#F0654D] text-white`}>
      <span>{label}</span>
      <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/20 text-white">{count}</span>
    </button>
  ) : (
    <button onClick={onClick} className={`${base} font-medium text-gray-600 hover:bg-white/60 hover:text-gray-800`}>
      <span>{label}</span>
      <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500">{count}</span>
    </button>
  );
}

function StatCard({ label, count, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{count}</p>
    </div>
  );
}

function QuickFilter({ label, count, color, highlight, onClick, disabled }) {
  const style = highlight
    ? { background: `${color}12`, border: `1px solid ${color}30` }
    : { background: '#f9fafb', border: '1px solid #f3f4f6' };
  return (
    <div
      style={style}
      onClick={disabled ? undefined : onClick}
      className={`rounded-2xl p-4 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-95'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {disabled && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Coming soon</span>
          )}
        </div>
        <span className="text-xl font-bold" style={{ color }}>{count}</span>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const {
    query, setQuery,
    tasks, total, page, pageSize, totalPages,
    loading, error, devLoginAdmin,
  } = useTasks();

  // ── Scope filtering (client-side — backend has no scope param yet) ──────────
  const displayTasks = query.scope === 'MINE'
    ? tasks.filter(t => t.assignedToUserId === MOCK_USER.id)
    : tasks;

  // ── Derived counts (page-level) ─────────────────────────────────────────────
  const open        = displayTasks.filter(t => t.status === 'TODO').length;
  const inProgress  = displayTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const done        = displayTasks.filter(t => t.status === 'DONE').length;
  const cancelled   = displayTasks.filter(t => t.status === 'CANCELLED').length;
  const myTaskCount = tasks.filter(t => t.assignedToUserId === MOCK_USER.id).length;
  const highPrio    = displayTasks.filter(t => t.priority === 'HIGH' || t.priority === 'URGENT').length;

  // ── Active nav view ─────────────────────────────────────────────────────────
  let activeView = 'ALL';
  if (query.scope === 'MINE')             activeView = 'MINE';
  else if (query.status === 'DONE')       activeView = 'COMPLETED';
  else if (query.status === 'CANCELLED')  activeView = 'CANCELLED';

  // ── Sidebar nav handlers ────────────────────────────────────────────────────
  const showAll       = () => setQuery({ scope: 'ALL',  status: '', priority: '', q: '' });
  const showMine      = () => setQuery({ scope: 'MINE', status: '', priority: '', q: '' });
  const showCompleted = () => setQuery({ scope: 'ALL',  status: 'DONE',      priority: '', q: '' });
  const showCancelled = () => setQuery({ scope: 'ALL',  status: 'CANCELLED', priority: '', q: '' });

  // ── Filter bar handler ──────────────────────────────────────────────────────
  const handleFilterChange = (key, value) => setQuery({ [key]: value });

  // ── Pagination ──────────────────────────────────────────────────────────────
  const from        = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to          = Math.min(page * pageSize, total);
  const prevEnabled = page > 1 && !loading;
  const nextEnabled = page < totalPages && !loading;

  return (
    <div className="h-screen overflow-hidden bg-[#F6F7F9] grid grid-cols-[260px_1fr_320px]">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="bg-[#F5EDE6] flex flex-col p-6 gap-5 overflow-y-auto">

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
          <div className="w-10 h-10 bg-[#F0654D] rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
            {MOCK_USER.avatar}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{MOCK_USER.name}</p>
            <p className="text-xs text-gray-500">{MOCK_USER.role}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1">Menu</p>
          <NavItem label="All Tasks"  active={activeView === 'ALL'}       count={total}        onClick={showAll} />
          <NavItem label="My Tasks"   active={activeView === 'MINE'}      count={myTaskCount}  onClick={showMine} />
          <NavItem label="Completed"  active={activeView === 'COMPLETED'} count={done}         onClick={showCompleted} />
          <NavItem label="Cancelled"  active={activeView === 'CANCELLED'} count={cancelled}    onClick={showCancelled} />
        </nav>

        <div className="flex-1" />

        {/* Log out */}
        <button className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-500 hover:text-[#F0654D] hover:bg-white/60 rounded-xl transition-colors w-full">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Log Out
        </button>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Tasks</h1>
          <button className="flex items-center gap-2 bg-[#F0654D] hover:bg-[#E85B44] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New Task
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Open"        count={open}       color="#4C8DFF" />
          <StatCard label="In Progress" count={inProgress} color="#F4A23A" />
          <StatCard label="Completed"   count={done}       color="#43B96D" />
        </div>

        {/* Filters */}
        <FiltersBar
          status={query.status}
          priority={query.priority}
          q={query.q}
          onChange={handleFilterChange}
        />

        {/* Error banner */}
        <ErrorBanner error={error} onDevLogin={devLoginAdmin} />

        {/* Task table */}
        <TaskTable tasks={displayTasks} loading={loading} />

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Showing {from}–{to} of {total} tasks</span>
          <div className="flex items-center gap-1">
            <button
              disabled={!prevEnabled}
              onClick={() => setQuery({ page: page - 1 })}
              className={`px-3 py-1.5 rounded-lg border border-gray-200 ${prevEnabled ? 'hover:bg-gray-50 text-gray-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}
            >
              Previous
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-[#F0654D] text-white font-semibold">
              {page} / {totalPages}
            </button>
            <button
              disabled={!nextEnabled}
              onClick={() => setQuery({ page: page + 1 })}
              className={`px-3 py-1.5 rounded-lg border border-gray-200 ${nextEnabled ? 'hover:bg-gray-50 text-gray-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}
            >
              Next
            </button>
          </div>
        </div>
      </main>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <aside className="border-l border-black/5 p-6 flex flex-col gap-3 overflow-y-auto">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Quick Filters</h2>
        <QuickFilter
          label="All Tasks"     count={total}        color="#F0654D" highlight={false}
          onClick={showAll}
        />
        <QuickFilter
          label="My Tasks"      count={myTaskCount}  color="#4C8DFF" highlight={false}
          onClick={showMine}
        />
        <QuickFilter
          label="Blocked"       count={0}            color="#F05A5A" highlight
          disabled
        />
        <QuickFilter
          label="High Priority" count={highPrio}     color="#F97316" highlight
          onClick={() => setQuery({ priority: 'HIGH' })}
        />
      </aside>

    </div>
  );
}
