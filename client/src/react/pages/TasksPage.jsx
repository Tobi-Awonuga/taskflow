import { useState, useEffect, useMemo } from 'react';
import { useSearchParams }     from 'react-router-dom';
import { useAuth }             from '../context/AuthContext.jsx';
import { useTasks }            from '../hooks/useTasks.js';
import ErrorBanner             from '../components/ErrorBanner.jsx';
import FiltersBar              from '../components/FiltersBar.jsx';
import TaskTable               from '../components/TaskTable.jsx';
import CreateTaskModal         from '../components/CreateTaskModal.jsx';
import TaskDetailDrawer        from '../components/TaskDetailDrawer.jsx';

function StatCard({ label, count, color, barColor, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`relative bg-white rounded-2xl p-5 border shadow-sm text-left w-full transition-all overflow-hidden hover:shadow-md
        ${active ? 'border-[#F0654D]/40 ring-2 ring-[#F0654D]/15 bg-[#F0654D]/[0.02]' : 'border-black/[0.04] hover:border-gray-200'}`}
    >
      <span
        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
        style={{ backgroundColor: active ? color : barColor ?? color, opacity: active ? 1 : 0.35 }}
      />
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{count}</p>
    </button>
  );
}

export default function TasksPage() {
  const { user }       = useAuth();
  const [showCreate,   setShowCreate]   = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [allUsers,     setAllUsers]     = useState([]);
  const [stats,        setStats]        = useState({ todo: 0, inProgress: 0, blocked: 0, done: 0, overdue: 0 });
  const [activeKpi,    setActiveKpi]    = useState('');

  // useTasks MUST come before any effect that reads `query`
  const {
    query, setQuery,
    tasks, total, page, pageSize, totalPages,
    loading, error, devLoginAdmin,
    updateTaskStatus, updateTaskPriority, updateTask, createTask,
  } = useTasks();

  const [searchParams] = useSearchParams();

  const userMap = useMemo(
    () => Object.fromEntries(allUsers.map(u => [u.id, u])),
    [allUsers]
  );

  // users fetch
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/users/all', { credentials: 'include', signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { users: [] })
      .then(d => setAllUsers(d.users ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // stats fetch — safe to reference query now
  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (query.assignedToUserId) params.set('assignedToUserId', query.assignedToUserId);
    fetch(`/api/tasks/stats?${params}`, { credentials: 'include', signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStats(d))
      .catch(() => {});
    return () => ctrl.abort();
  }, [query.assignedToUserId, tasks]);

  // scope=mine → server-side filter; reset KPI filter on scope change
  useEffect(() => {
    const isMine = searchParams.get('scope') === 'mine';
    setQuery({
      scope:            isMine ? 'MINE' : 'ALL',
      assignedToUserId: isMine ? (user?.id ?? '') : '',
      status:           '',
      overdue:          '',
    });
    setActiveKpi('');
  }, [searchParams, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep drawer in sync with refetched task data
  const drawerTask = selectedTask
    ? (tasks.find(t => t.id === selectedTask.id) ?? selectedTask)
    : null;

  // ── KPI card click — toggles a status/overdue filter ───────────────────────
  function handleKpiClick(kpi) {
    if (activeKpi === kpi) {
      setQuery({ status: '', overdue: '' });
      setActiveKpi('');
    } else {
      const filters = {
        todo:       { status: 'TODO',        overdue: '' },
        inProgress: { status: 'IN_PROGRESS', overdue: '' },
        blocked:    { status: 'BLOCKED',     overdue: '' },
        done:       { status: 'DONE',        overdue: '' },
        overdue:    { status: '',            overdue: 'true' },
      }[kpi];
      setQuery(filters);
      setActiveKpi(kpi);
    }
  }

  // ── Filter bar handler ──────────────────────────────────────────────────────
  const handleFilterChange = (key, value) => setQuery({ [key]: value });

  // ── Pagination ──────────────────────────────────────────────────────────────
  const from        = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to          = Math.min(page * pageSize, total);
  const prevEnabled = page > 1 && !loading;
  const nextEnabled = page < totalPages && !loading;

  return (
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto animate-page-enter">

      {/* Header */}
      <div className="flex items-start justify-between pb-5 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {query.scope === 'MINE' ? 'Tasks assigned to you' : 'All workspace tasks'}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[#F0654D] hover:bg-[#E85B44] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm" style={{ boxShadow: '0 2px 8px rgba(240,101,77,0.3)' }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Task
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Open"        count={stats.todo}       color="#4C8DFF" barColor="#4C8DFF" onClick={() => handleKpiClick('todo')}       active={activeKpi === 'todo'} />
        <StatCard label="In Progress" count={stats.inProgress} color="#F4A23A" barColor="#F4A23A" onClick={() => handleKpiClick('inProgress')} active={activeKpi === 'inProgress'} />
        <StatCard label="Blocked"     count={stats.blocked}    color="#F05A5A" barColor="#F05A5A" onClick={() => handleKpiClick('blocked')}    active={activeKpi === 'blocked'} />
        <StatCard label="Overdue"     count={stats.overdue}    color="#EF4444" barColor="#EF4444" onClick={() => handleKpiClick('overdue')}    active={activeKpi === 'overdue'} />
        <StatCard label="Done"        count={stats.done}       color="#43B96D" barColor="#43B96D" onClick={() => handleKpiClick('done')}       active={activeKpi === 'done'} />
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
      <TaskTable
        tasks={tasks}
        loading={loading}
        onUpdateStatus={updateTaskStatus}
        onUpdatePriority={updateTaskPriority}
        onTaskClick={setSelectedTask}
        userMap={userMap}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {total === 0 ? 'No tasks' : `Showing ${from}–${to} of ${total} tasks`}
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={!prevEnabled}
            onClick={() => setQuery({ page: page - 1 })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors
              ${prevEnabled ? 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-sm' : 'border-gray-100 text-gray-300 cursor-not-allowed bg-white'}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Prev
          </button>
          <span className="px-3 py-1.5 rounded-xl bg-[#F0654D] text-white text-sm font-semibold min-w-[64px] text-center">
            {page} / {totalPages || 1}
          </span>
          <button
            disabled={!nextEnabled}
            onClick={() => setQuery({ page: page + 1 })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors
              ${nextEnabled ? 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-sm' : 'border-gray-100 text-gray-300 cursor-not-allowed bg-white'}`}
          >
            Next
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={createTask}
        user={user}
      />

      <TaskDetailDrawer
        task={drawerTask}
        onClose={() => setSelectedTask(null)}
        onUpdateStatus={updateTaskStatus}
        onUpdatePriority={updateTaskPriority}
        onUpdateTask={updateTask}
        allUsers={allUsers}
        userMap={userMap}
        user={user}
      />

    </main>
  );
}
