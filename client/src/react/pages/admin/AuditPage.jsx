import { useState, useEffect } from 'react';

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const ACTION_META = {
  TASK_CREATED:          { label: 'Created task',        color: 'text-green-600'  },
  TASK_STATUS_CHANGED:   { label: 'Status changed',      color: 'text-blue-600'   },
  TASK_CANCELLED:        { label: 'Cancelled task',      color: 'text-red-600'    },
  TASK_REOPENED:         { label: 'Reopened task',       color: 'text-amber-600'  },
  TASK_ASSIGNED:         { label: 'Assigned task',       color: 'text-amber-600'  },
  TASK_UNASSIGNED:       { label: 'Unassigned task',     color: 'text-amber-600'  },
  TASK_PRIORITY_CHANGED: { label: 'Priority changed',    color: 'text-blue-600'   },
  TASK_UPDATED:          { label: 'Updated task',        color: 'text-blue-600'   },
  USER_CREATED:          { label: 'Created user',        color: 'text-green-600'  },
  USER_UPDATED:          { label: 'Updated user',        color: 'text-blue-600'   },
  USER_DEACTIVATED:      { label: 'Deactivated user',    color: 'text-red-600'    },
  DEPT_CREATED:          { label: 'Created department',  color: 'text-green-600'  },
  LOGIN_SUCCESS:         { label: 'Signed in',           color: 'text-gray-500'   },
  LOGOUT:                { label: 'Signed out',          color: 'text-gray-500'   },
};

function logDetail(log) {
  if (log.after?.status)          return `→ ${log.after.status}`;
  if (log.after?.priority)        return `→ ${log.after.priority}`;
  if (log.reason)                 return `"${log.reason}"`;
  if (log.after?.passwordChanged) return 'Password updated';
  if (log.after?.title)           return log.after.title;
  return '—';
}

export default function AuditPage() {
  const [logs, setLogs]             = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(true);
  const [actionFilter, setAction]   = useState('');
  const [entityFilter, setEntity]   = useState('');

  useEffect(() => {
    setLoading(true);
    let url = `/api/audit?page=${page}&pageSize=50`;
    if (actionFilter) url += `&action=${actionFilter}`;
    if (entityFilter) url += `&entityType=${entityFilter}`;
    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { logs: [], total: 0, totalPages: 1 })
      .then(d => {
        setLogs(d.logs ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
      })
      .finally(() => setLoading(false));
  }, [page, actionFilter, entityFilter]);

  const prevEnabled = page > 1 && !loading;
  const nextEnabled = page < totalPages && !loading;

  return (
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Audit Logs <span className="text-lg font-normal text-gray-400">({total})</span></h1>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={actionFilter}
          onChange={e => { setAction(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30"
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_META).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={e => { setEntity(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30"
        >
          <option value="">All Entities</option>
          <option value="TASK">TASK</option>
          <option value="USER">USER</option>
          <option value="DEPARTMENT">DEPARTMENT</option>
          <option value="SESSION">SESSION</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3.5">Time</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Actor</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Action</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Entity</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Detail</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">No logs found.</td></tr>
            ) : logs.map((log, idx) => {
              const meta = ACTION_META[log.action];
              return (
                <tr key={log.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#F0654D] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {initials(log.actor?.name)}
                      </div>
                      <span className="text-sm text-gray-700">{log.actor?.name ?? 'System'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${meta?.color ?? 'text-gray-600'}`}>
                      {meta?.label ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {log.entityType} #{log.entityId ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {logDetail(log)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-1 text-sm">
        <button
          disabled={!prevEnabled}
          onClick={() => setPage(p => p - 1)}
          className={`px-3 py-1.5 rounded-lg border border-gray-200 ${prevEnabled ? 'hover:bg-gray-50 text-gray-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}
        >
          Previous
        </button>
        <button className="px-3 py-1.5 rounded-lg bg-[#F0654D] text-white font-semibold">
          {page} / {totalPages}
        </button>
        <button
          disabled={!nextEnabled}
          onClick={() => setPage(p => p + 1)}
          className={`px-3 py-1.5 rounded-lg border border-gray-200 ${nextEnabled ? 'hover:bg-gray-50 text-gray-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}
        >
          Next
        </button>
      </div>

    </main>
  );
}
