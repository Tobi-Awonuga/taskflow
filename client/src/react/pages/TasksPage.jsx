import { useState, useEffect, useMemo } from 'react';
import { useSearchParams }     from 'react-router-dom';
import { useAuth }             from '../context/AuthContext.jsx';
import { useTasks }            from '../hooks/useTasks.js';
import ErrorBanner             from '../components/ErrorBanner.jsx';
import FiltersBar              from '../components/FiltersBar.jsx';
import TaskTable               from '../components/TaskTable.jsx';
import CreateTaskModal         from '../components/CreateTaskModal.jsx';
import TaskDetailDrawer        from '../components/TaskDetailDrawer.jsx';

function StatCard({ label, count, color, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border shadow-sm text-left w-full transition-all
        ${active ? 'border-[#F0654D] ring-2 ring-[#F0654D]/20 shadow-md' : 'border-black/5 hover:border-gray-200'}`}
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{count}</p>
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
    fetch('/api/users?pageSize=100&isActive=true', { credentials: 'include', signal: ctrl.signal })
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
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Tasks</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[#F0654D] hover:bg-[#E85B44] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Task
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Open"        count={stats.todo}       color="#4C8DFF" onClick={() => handleKpiClick('todo')}       active={activeKpi === 'todo'} />
        <StatCard label="In Progress" count={stats.inProgress} color="#F4A23A" onClick={() => handleKpiClick('inProgress')} active={activeKpi === 'inProgress'} />
        <StatCard label="Blocked"     count={stats.blocked}    color="#F05A5A" onClick={() => handleKpiClick('blocked')}    active={activeKpi === 'blocked'} />
        <StatCard label="Overdue"     count={stats.overdue}    color="#EF4444" onClick={() => handleKpiClick('overdue')}    active={activeKpi === 'overdue'} />
        <StatCard label="Done"        count={stats.done}       color="#43B96D" onClick={() => handleKpiClick('done')}       active={activeKpi === 'done'} />
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
