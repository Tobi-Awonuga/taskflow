import { useState, useEffect } from 'react';
import { Link }              from 'react-router-dom';
import { useAuth }           from '../context/AuthContext.jsx';
import TaskDetailDrawer      from '../components/TaskDetailDrawer.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(name) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name?.split(' ')[0] ?? 'there'}!`;
}

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PRIORITY_CLS = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH:   'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-gray-100 text-gray-500',
};

const ACTION_META = {
  TASK_CREATED:               { label: 'Created task',         color: 'text-green-600',  dot: '#43B96D' },
  TASK_STATUS_CHANGED:        { label: 'Status changed',       color: 'text-blue-600',   dot: '#4C8DFF' },
  TASK_CANCELLED:             { label: 'Cancelled task',       color: 'text-red-600',    dot: '#F05A5A' },
  TASK_REOPENED:              { label: 'Reopened task',        color: 'text-amber-600',  dot: '#F4A23A' },
  TASK_ASSIGNED:              { label: 'Assigned task',        color: 'text-amber-600',  dot: '#F4A23A' },
  TASK_UNASSIGNED:            { label: 'Unassigned task',      color: 'text-amber-600',  dot: '#F4A23A' },
  TASK_PRIORITY_CHANGED:      { label: 'Priority changed',     color: 'text-blue-600',   dot: '#4C8DFF' },
  TASK_UPDATED:               { label: 'Updated task',         color: 'text-blue-600',   dot: '#4C8DFF' },
  TASK_COLLABORATOR_ADDED:    { label: 'Added collaborator',   color: 'text-green-600',  dot: '#43B96D' },
  TASK_COLLABORATOR_REMOVED:  { label: 'Removed collaborator', color: 'text-gray-500',   dot: '#9CA3AF' },
  USER_CREATED:               { label: 'Created user',         color: 'text-green-600',  dot: '#43B96D' },
  USER_UPDATED:               { label: 'Updated user',         color: 'text-blue-600',   dot: '#4C8DFF' },
  USER_DEACTIVATED:           { label: 'Deactivated user',     color: 'text-red-600',    dot: '#F05A5A' },
  DEPT_CREATED:               { label: 'Created department',   color: 'text-green-600',  dot: '#43B96D' },
  LOGIN_SUCCESS:              { label: 'Signed in',            color: 'text-gray-400',   dot: '#9CA3AF' },
  LOGOUT:                     { label: 'Signed out',           color: 'text-gray-400',   dot: '#9CA3AF' },
};

const STATUS_LABELS   = { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done', BLOCKED: 'Blocked', CANCELLED: 'Cancelled' };
const PRIORITY_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };

function activityDetail(log) {
  const { action, before, after } = log;
  if (action === 'TASK_STATUS_CHANGED' || action === 'TASK_CANCELLED' || action === 'TASK_REOPENED') {
    const from = before?.status ? (STATUS_LABELS[before.status] ?? before.status) : null;
    const to   = after?.status  ? (STATUS_LABELS[after.status]  ?? after.status)  : null;
    if (from && to) return `${from} → ${to}`;
    if (to)         return `→ ${to}`;
  }
  if (action === 'TASK_PRIORITY_CHANGED') {
    const from = before?.priority ? (PRIORITY_LABELS[before.priority] ?? before.priority) : null;
    const to   = after?.priority  ? (PRIORITY_LABELS[after.priority]  ?? after.priority)  : null;
    if (from && to) return `${from} → ${to}`;
  }
  if (action === 'TASK_COLLABORATOR_ADDED' || action === 'TASK_COLLABORATOR_REMOVED') {
    const name = after?.collaboratorName ?? before?.collaboratorName;
    return name ? `${action === 'TASK_COLLABORATOR_ADDED' ? '+' : '−'} ${name}` : null;
  }
  return null;
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStatCard({ label, count, color, icon }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-black/[0.04] shadow-sm flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold leading-none" style={{ color }}>{count}</p>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">{label}</p>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const cls = PRIORITY_CLS[priority] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{priority}</span>
  );
}

function DueBadge({ dueAt }) {
  if (!dueAt) return null;
  const due   = new Date(dueAt);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.floor((due - today) / 86400000);
  if (diff < 0)   return <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Overdue</span>;
  if (diff === 0) return <span className="text-xs font-semibold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">Due today</span>;
  if (diff === 1) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Tomorrow</span>;
  return <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Due {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>;
}

function TaskRow({ task, onClick, overdue = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors duration-100
        ${overdue ? 'hover:bg-red-50/60' : 'hover:bg-gray-50/80'}`}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${overdue ? 'text-red-600' : 'text-gray-800'}`}>{task.title}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <DueBadge dueAt={task.dueAt} />
        <PriorityBadge priority={task.priority} />
      </div>
    </button>
  );
}

function ActivityRow({ log }) {
  const meta = ACTION_META[log.action];
  const dot  = meta?.dot ?? '#9CA3AF';
  return (
    <div className="flex items-start gap-3 px-5 py-3 relative">
      {/* Timeline dot */}
      <div className="shrink-0 mt-1.5 flex flex-col items-center">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 leading-snug">
          <span className="font-semibold text-gray-800">{log.actor?.name ?? 'System'}</span>
          {' '}
          <span className={`font-medium ${meta?.color ?? 'text-gray-500'}`}>{meta?.label ?? log.action}</span>
          {' '}
          <span className="text-gray-400 text-xs">
            {log.entityType === 'SESSION' ? 'login event' : `${log.entityType?.toLowerCase()} #${log.entityId ?? '—'}`}
          </span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{relativeTime(log.createdAt)}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();

  const [openTasks,    setOpenTasks]    = useState([]);
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [stats,        setStats]        = useState({ todo: 0, overdue: 0, done: 0 });
  const [activity,     setActivity]     = useState([]);
  const [allUsers,     setAllUsers]     = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [refetch,      setRefetch]      = useState(0);

  useEffect(() => {
    if (!user) return;
    const id = user.id;

    fetch(`/api/tasks?assignedToUserId=${id}&status=TODO&pageSize=5`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { tasks: [] })
      .then(d => setOpenTasks(d.tasks ?? []));

    fetch(`/api/tasks?assignedToUserId=${id}&overdue=true&pageSize=5`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { tasks: [] })
      .then(d => setOverdueTasks(d.tasks ?? []));

    fetch(`/api/tasks/stats?assignedToUserId=${id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStats(d));

    fetch('/api/audit?pageSize=10', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { logs: [] })
      .then(d => setActivity(d.logs ?? []));

    fetch('/api/users?pageSize=100&isActive=true', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { users: [] })
      .then(d => setAllUsers(d.users ?? []));
  }, [user?.id, refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const allFetched = [...openTasks, ...overdueTasks];
  const drawerTask = selectedTask
    ? (allFetched.find(t => t.id === selectedTask.id) ?? selectedTask)
    : null;

  async function updateTaskStatus(taskId, status, cancelReason) {
    const body = { status };
    if (status === 'CANCELLED' && cancelReason) body.cancelReason = cancelReason;
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) setRefetch(n => n + 1);
    return res.ok;
  }

  async function updateTaskPriority(taskId, priority) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    });
    if (res.ok) setRefetch(n => n + 1);
    return res.ok;
  }

  async function updateTask(taskId, fields) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (res.ok) setRefetch(n => n + 1);
    return res.ok ? { ok: true } : { ok: false, error: data.error };
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto animate-page-enter">

      {/* Header */}
      <div className="pb-5 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">{greeting(user?.name)}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{today}</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — My Work (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* My Open Tasks */}
          <section className="bg-white rounded-2xl border border-black/[0.04] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">My Open Tasks</h2>
                <span className="text-xs font-semibold text-[#4C8DFF] bg-blue-50 px-2 py-0.5 rounded-full">{stats.todo}</span>
              </div>
              <Link to="/tasks?scope=mine" className="text-xs text-[#F0654D] hover:underline font-medium">
                View all →
              </Link>
            </div>
            {openTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#43B96D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="text-sm font-medium text-gray-500">All caught up!</p>
                <p className="text-xs text-gray-400">No open tasks assigned to you.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {openTasks.map(task => (
                  <TaskRow key={task.id} task={task} onClick={() => setSelectedTask(task)} />
                ))}
              </div>
            )}
          </section>

          {/* Overdue */}
          <section className="bg-white rounded-2xl border border-black/[0.04] shadow-sm overflow-hidden">
            <div className={`px-5 py-4 border-b flex items-center justify-between
              ${overdueTasks.length > 0 ? 'border-red-100 bg-red-50/40' : 'border-gray-100'}`}
            >
              <div className="flex items-center gap-2">
                {overdueTasks.length > 0 && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
                <h2 className={`text-sm font-semibold ${overdueTasks.length > 0 ? 'text-red-700' : 'text-gray-800'}`}>
                  Overdue
                </h2>
                <span className="text-xs font-semibold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">{stats.overdue}</span>
              </div>
              <Link to="/tasks?overdue=true" className="text-xs text-[#F0654D] hover:underline font-medium">
                View all →
              </Link>
            </div>
            {overdueTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#43B96D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p className="text-sm font-medium text-gray-500">On track</p>
                <p className="text-xs text-gray-400">No overdue tasks.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {overdueTasks.map(task => (
                  <TaskRow key={task.id} task={task} onClick={() => setSelectedTask(task)} overdue />
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Right — My Stats (1/3) */}
        <div className="flex flex-col gap-4">
          <MiniStatCard
            label="Open"
            count={stats.todo}
            color="#4C8DFF"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4C8DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
          />
          <MiniStatCard
            label="Overdue"
            count={stats.overdue}
            color="#EF4444"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
          <MiniStatCard
            label="Done"
            count={stats.done}
            color="#43B96D"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#43B96D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
          />
        </div>

      </div>

      {/* Recent Activity */}
      <section className="bg-white rounded-2xl border border-black/[0.04] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Recent Activity</h2>
        </div>
        {activity.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <p className="text-sm text-gray-400">No recent activity.</p>
          </div>
        ) : (
          <div className="pl-5 border-l-2 border-gray-100 ml-5 my-3">
            {activity.map(log => (
              <ActivityRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </section>

      <TaskDetailDrawer
        task={drawerTask}
        onClose={() => setSelectedTask(null)}
        onUpdateStatus={updateTaskStatus}
        onUpdatePriority={updateTaskPriority}
        onUpdateTask={updateTask}
        allUsers={allUsers}
        user={user}
      />

    </main>
  );
}
