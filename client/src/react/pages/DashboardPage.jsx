import { useState, useEffect } from 'react';
import { useAuth }        from '../context/AuthContext.jsx';
import TaskDetailDrawer   from '../components/TaskDetailDrawer.jsx';

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
  if (mins < 60) return `${mins} min ago`;
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
  TASK_CREATED:          { label: 'Created task',        color: 'text-green-600' },
  TASK_STATUS_CHANGED:   { label: 'Status changed',      color: 'text-blue-600'  },
  TASK_CANCELLED:        { label: 'Cancelled task',      color: 'text-red-600'   },
  TASK_REOPENED:         { label: 'Reopened task',       color: 'text-amber-600' },
  TASK_ASSIGNED:         { label: 'Assigned task',       color: 'text-amber-600' },
  TASK_UNASSIGNED:       { label: 'Unassigned task',     color: 'text-amber-600' },
  TASK_PRIORITY_CHANGED: { label: 'Priority changed',    color: 'text-blue-600'  },
  TASK_UPDATED:          { label: 'Updated task',        color: 'text-blue-600'  },
  USER_CREATED:          { label: 'Created user',        color: 'text-green-600' },
  USER_UPDATED:          { label: 'Updated user',        color: 'text-blue-600'  },
  USER_DEACTIVATED:      { label: 'Deactivated user',    color: 'text-red-600'   },
  DEPT_CREATED:          { label: 'Created department',  color: 'text-green-600' },
  LOGIN_SUCCESS:         { label: 'Signed in',           color: 'text-gray-500'  },
  LOGOUT:                { label: 'Signed out',          color: 'text-gray-500'  },
};

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStatCard({ label, count, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{count}</p>
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
  const due  = new Date(dueAt);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff  = Math.floor((due - today) / 86400000);
  if (diff < 0)  return <span className="text-xs font-semibold text-red-500">Overdue</span>;
  if (diff === 0) return <span className="text-xs font-semibold text-orange-500">Due today</span>;
  if (diff === 1) return <span className="text-xs font-semibold text-amber-500">Tomorrow</span>;
  return <span className="text-xs text-gray-400">Due {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>;
}

function TaskRow({ task, onClick, overdue = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors
        ${overdue ? 'border-l-2 border-red-400' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
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
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <div className="w-7 h-7 rounded-full bg-[#F0654D] flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5">
        {initials(log.actor?.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">
          <span className="font-medium">{log.actor?.name ?? 'System'}</span>
          {' '}
          <span className={meta?.color ?? 'text-gray-500'}>{meta?.label ?? log.action}</span>
          {' '}
          <span className="text-gray-400">{log.entityType} #{log.entityId ?? '—'}</span>
        </p>
      </div>
      <span className="text-xs text-gray-400 shrink-0">{relativeTime(log.createdAt)}</span>
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

  // Keep drawer in sync after refetch
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
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{greeting(user?.name)}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{today}</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — My Work (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* My Open Tasks */}
          <section className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">My Open Tasks</h2>
              <span className="text-xs font-semibold text-[#4C8DFF] bg-blue-50 px-2 py-0.5 rounded-full">{stats.todo}</span>
            </div>
            {openTasks.length === 0
              ? <p className="px-5 py-8 text-sm text-gray-400 text-center">No open tasks — you&apos;re all caught up.</p>
              : <div className="divide-y divide-gray-50">
                  {openTasks.map(task => (
                    <TaskRow key={task.id} task={task} onClick={() => setSelectedTask(task)} />
                  ))}
                </div>
            }
          </section>

          {/* Overdue */}
          <section className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Overdue</h2>
              <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{stats.overdue}</span>
            </div>
            {overdueTasks.length === 0
              ? <p className="px-5 py-8 text-sm text-gray-400 text-center">Nothing overdue.</p>
              : <div className="divide-y divide-gray-50">
                  {overdueTasks.map(task => (
                    <TaskRow key={task.id} task={task} onClick={() => setSelectedTask(task)} overdue />
                  ))}
                </div>
            }
          </section>

        </div>

        {/* Right — My Stats (1/3) */}
        <div className="flex flex-col gap-4">
          <MiniStatCard label="Open"    count={stats.todo}    color="#4C8DFF" />
          <MiniStatCard label="Overdue" count={stats.overdue} color="#EF4444" />
          <MiniStatCard label="Done"    count={stats.done}    color="#43B96D" />
        </div>

      </div>

      {/* Recent Activity */}
      <section className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Recent Activity</h2>
        </div>
        {activity.length === 0
          ? <p className="px-5 py-8 text-sm text-gray-400 text-center">No recent activity.</p>
          : <div className="divide-y divide-gray-50">
              {activity.map(log => (
                <ActivityRow key={log.id} log={log} />
              ))}
            </div>
        }
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
