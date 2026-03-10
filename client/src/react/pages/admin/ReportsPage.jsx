import { useState, useEffect } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  TODO:        '#4C8DFF',
  IN_PROGRESS: '#F4A23A',
  BLOCKED:     '#F05A5A',
  DONE:        '#43B96D',
  CANCELLED:   '#9CA3AF',
};

const STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
const STATUS_LABELS = {
  TODO:        'To Do',
  IN_PROGRESS: 'In Progress',
  BLOCKED:     'Blocked',
  DONE:        'Done',
  CANCELLED:   'Cancelled',
};

// ── Utility helpers ───────────────────────────────────────────────────────────

function formatCycleTime(ms) {
  if (ms == null) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts = [];
  if (days  > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (parts.length === 0 && minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push('<1m');
  return parts.join(' ');
}

function rateColor(rate) {
  if (rate >= 0.6) return '#43B96D';
  if (rate >= 0.3) return '#F4A23A';
  return '#F05A5A';
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-black/5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-sm font-semibold text-gray-800">{children}</h2>
  );
}

function MiniBar({ rate }) {
  const pct   = Math.round((rate ?? 0) * 100);
  const color = rateColor(rate ?? 0);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color, minWidth: '3rem', textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
}

function TableHead({ cols }) {
  return (
    <thead>
      <tr className="bg-gray-50/80 border-b border-gray-100">
        {cols.map((col, i) => (
          <th
            key={i}
            className={`px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest ${i === 0 ? 'text-left' : 'text-right'}`}
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function NumCell({ value, warn }) {
  return (
    <td className="px-5 py-3.5 text-right text-sm tabular-nums">
      <span className={warn && value > 0 ? 'text-red-500 font-semibold' : 'text-gray-700'}>
        {value}
      </span>
    </td>
  );
}

// ── Skeleton components ───────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="p-5">
          <div className="h-3 w-20 bg-gray-200 animate-pulse rounded mb-3" />
          <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ cols, rows = 5 }) {
  return (
    <tbody>
      {[...Array(rows)].map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          {[...Array(cols)].map((_, j) => (
            <td key={j} className="px-5 py-3.5">
              <div className="h-3 bg-gray-100 animate-pulse rounded" style={{ width: j === 0 ? '8rem' : '3rem', marginLeft: j !== 0 ? 'auto' : undefined }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function BreakdownSkeleton() {
  return (
    <Card className="p-6 flex flex-col gap-4">
      <div className="h-3 w-32 bg-gray-200 animate-pulse rounded" />
      <div className="h-5 w-full bg-gray-100 animate-pulse rounded-full" />
      <div className="flex gap-4 flex-wrap">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-3 w-16 bg-gray-100 animate-pulse rounded" />
        ))}
      </div>
    </Card>
  );
}

// ── Overview stat cards ───────────────────────────────────────────────────────

function OverviewCards({ data }) {
  const pct          = Math.round((data.completionRate ?? 0) * 100);
  const rateCol      = rateColor(data.completionRate ?? 0);
  const overdueColor = (data.overdueCount ?? 0) > 0 ? '#F05A5A' : '#43B96D';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Tasks */}
      <Card className="p-5 flex flex-col gap-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Total Tasks</p>
        <p className="text-3xl font-bold text-gray-900 tabular-nums mt-1">{data.totalTasks ?? 0}</p>
        <p className="text-xs text-gray-400 mt-0.5">across all statuses</p>
      </Card>

      {/* Completion Rate */}
      <Card className="p-5 flex flex-col gap-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Completion Rate</p>
        <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: rateCol }}>{pct}%</p>
        <p className="text-xs text-gray-400 mt-0.5">tasks marked done</p>
      </Card>

      {/* Avg Cycle Time */}
      <Card className="p-5 flex flex-col gap-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Avg Cycle Time</p>
        <p className="text-3xl font-bold text-gray-900 tabular-nums mt-1">
          {formatCycleTime(data.avgCycleTimeMs)}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">in-progress → done</p>
      </Card>

      {/* Overdue */}
      <Card className="p-5 flex flex-col gap-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Overdue Tasks</p>
        <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: overdueColor }}>
          {data.overdueCount ?? 0}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">past due date</p>
      </Card>
    </div>
  );
}

// ── Status breakdown ──────────────────────────────────────────────────────────

function StatusBreakdown({ breakdown }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return (
    <Card className="p-6 flex flex-col gap-4">
      <SectionTitle>Status Breakdown</SectionTitle>

      {/* Stacked bar */}
      {total === 0 ? (
        <div className="h-5 bg-gray-100 rounded-full flex items-center justify-center">
          <span className="text-xs text-gray-400">No data</span>
        </div>
      ) : (
        <div className="flex h-5 w-full rounded-full overflow-hidden gap-px bg-gray-100">
          {STATUS_ORDER.map(s => {
            const pct = (breakdown[s] ?? 0) / total * 100;
            if (pct === 0) return null;
            return (
              <div
                key={s}
                className="h-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s] }}
                title={`${STATUS_LABELS[s]}: ${breakdown[s]} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {STATUS_ORDER.map(s => {
          const n   = breakdown[s] ?? 0;
          const pct = total > 0 ? Math.round(n / total * 100) : 0;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
              <span className="text-xs text-gray-500">{STATUS_LABELS[s]}</span>
              <span className="text-xs font-semibold text-gray-700 tabular-nums">{n}</span>
              <span className="text-xs text-gray-400 tabular-nums">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── By-Department table ───────────────────────────────────────────────────────

const DEPT_COLS = ['Department', 'Total', 'Done', 'In Progress', 'Overdue', 'Completion Rate'];

function DeptTable({ depts }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <SectionTitle>By Department</SectionTitle>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHead cols={DEPT_COLS} />
          {depts.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={DEPT_COLS.length} className="px-6 py-10 text-center text-sm text-gray-400">
                  No department data
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {depts.map(d => (
                <tr key={d.id ?? 'null'} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-800">{d.name}</td>
                  <NumCell value={d.total} />
                  <NumCell value={d.done} />
                  <NumCell value={d.inProgress} />
                  <NumCell value={d.overdue} warn />
                  <td className="px-5 py-3.5" style={{ minWidth: '10rem' }}>
                    <MiniBar rate={d.completionRate} />
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </Card>
  );
}

// ── By-User table ─────────────────────────────────────────────────────────────

const USER_COLS = ['User', 'Assigned', 'Done', 'In Progress', 'Overdue', 'Completion Rate'];

function UserTable({ users: userList }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <SectionTitle>Workload by User</SectionTitle>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHead cols={USER_COLS} />
          {userList.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={USER_COLS.length} className="px-6 py-10 text-center text-sm text-gray-400">
                  No user data
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {userList.map(u => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                  </td>
                  <NumCell value={u.assigned} />
                  <NumCell value={u.done} />
                  <NumCell value={u.inProgress} />
                  <NumCell value={u.overdue} warn />
                  <td className="px-5 py-3.5" style={{ minWidth: '10rem' }}>
                    <MiniBar rate={u.completionRate} />
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </Card>
  );
}

// ── ReportsPage ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [overview,    setOverview]    = useState(null);
  const [byDept,      setByDept]      = useState(null);
  const [byUser,      setByUser]      = useState(null);
  const [overviewErr, setOverviewErr] = useState('');
  const [deptErr,     setDeptErr]     = useState('');
  const [userErr,     setUserErr]     = useState('');

  useEffect(() => {
    fetch('/api/reports/overview', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setOverview)
      .catch(e => setOverviewErr(String(e)));

    fetch('/api/reports/by-department', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setByDept)
      .catch(e => setDeptErr(String(e)));

    fetch('/api/reports/by-user', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setByUser)
      .catch(e => setUserErr(String(e)));
  }, []);

  return (
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto animate-page-enter">

      {/* Page header */}
      <div className="pb-5 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Task and workload analytics across your organisation</p>
      </div>

      {/* Overview cards */}
      {overviewErr ? (
        <p className="text-sm text-red-500">Failed to load overview: {overviewErr}</p>
      ) : !overview ? (
        <OverviewSkeleton />
      ) : (
        <OverviewCards data={overview} />
      )}

      {/* Status breakdown */}
      {!overview ? (
        <BreakdownSkeleton />
      ) : (
        <StatusBreakdown breakdown={overview.statusBreakdown} />
      )}

      {/* By department */}
      {deptErr ? (
        <p className="text-sm text-red-500">Failed to load department data: {deptErr}</p>
      ) : !byDept ? (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <SectionTitle>By Department</SectionTitle>
          </div>
          <table className="w-full">
            <TableHead cols={DEPT_COLS} />
            <TableSkeleton cols={DEPT_COLS.length} rows={4} />
          </table>
        </Card>
      ) : (
        <DeptTable depts={byDept.departments} />
      )}

      {/* By user */}
      {userErr ? (
        <p className="text-sm text-red-500">Failed to load user data: {userErr}</p>
      ) : !byUser ? (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <SectionTitle>Workload by User</SectionTitle>
          </div>
          <table className="w-full">
            <TableHead cols={USER_COLS} />
            <TableSkeleton cols={USER_COLS.length} rows={5} />
          </table>
        </Card>
      ) : (
        <UserTable users={byUser.users} />
      )}

    </main>
  );
}
