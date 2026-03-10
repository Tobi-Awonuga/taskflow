import { useState, useEffect } from 'react';

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const ACTION_META = {
  TASK_CREATED:          { label: 'Created task',        bg: 'bg-green-100',  text: 'text-green-700'  },
  TASK_STATUS_CHANGED:   { label: 'Status changed',      bg: 'bg-blue-100',   text: 'text-blue-700'   },
  TASK_CANCELLED:        { label: 'Cancelled task',      bg: 'bg-red-100',    text: 'text-red-600'    },
  TASK_REOPENED:         { label: 'Reopened task',       bg: 'bg-amber-100',  text: 'text-amber-700'  },
  TASK_ASSIGNED:         { label: 'Assigned task',       bg: 'bg-amber-100',  text: 'text-amber-700'  },
  TASK_UNASSIGNED:       { label: 'Unassigned task',     bg: 'bg-amber-100',  text: 'text-amber-700'  },
  TASK_PRIORITY_CHANGED: { label: 'Priority changed',    bg: 'bg-blue-100',   text: 'text-blue-700'   },
  TASK_UPDATED:          { label: 'Updated task',        bg: 'bg-blue-100',   text: 'text-blue-700'   },
  USER_CREATED:          { label: 'Created user',        bg: 'bg-green-100',  text: 'text-green-700'  },
  USER_UPDATED:          { label: 'Updated user',        bg: 'bg-blue-100',   text: 'text-blue-700'   },
  USER_DEACTIVATED:      { label: 'Deactivated user',    bg: 'bg-red-100',    text: 'text-red-600'    },
  DEPT_CREATED:          { label: 'Created department',  bg: 'bg-green-100',  text: 'text-green-700'  },
  LOGIN_SUCCESS:         { label: 'Signed in',           bg: 'bg-gray-100',   text: 'text-gray-500'   },
  LOGOUT:                { label: 'Signed out',          bg: 'bg-gray-100',   text: 'text-gray-500'   },
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
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto animate-page-enter">

      {/* Header */}
      <div className="pb-5 border-b border-gray-100 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
            <span className="text-sm font-semibold bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">{total}</span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">A full record of all actions taken in the workspace.</p>
        </div>
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
          <option value="TASK">Task</option>
          <option value="USER">User</option>
          <option value="DEPARTMENT">Department</option>
          <option value="SESSION">Login Events</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-5 py-3">Time</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Actor</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Action</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Entity</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <svg className="mx-auto mb-3 text-gray-300" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12h6M9 16h6M7 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-2" />
                    <path d="M9 3h6a1 1 0 011 1v1H8V4a1 1 0 011-1z" />
                  </svg>
                  <p className="text-sm text-gray-400">No audit logs found</p>
                </td>
              </tr>
            ) : logs.map(log => {
              const meta = ACTION_META[log.action];
              return (
                <tr key={log.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors duration-100">
                  <td className="px-5 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#F0654D] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {initials(log.actor?.name)}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{log.actor?.name ?? 'System'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ${meta ? `${meta.bg} ${meta.text}` : 'bg-gray-100 text-gray-500'}`}>
                      {meta?.label ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-500">
                    {log.entityType === 'SESSION'
                      ? <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Login Event</span>
                      : <span>{log.entityType} <span className="text-gray-400">#{log.entityId ?? '—'}</span></span>
                    }
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-500 max-w-xs truncate">
                    {logDetail(log)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2">
        <button
          disabled={!prevEnabled}
          onClick={() => setPage(p => p - 1)}
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
          onClick={() => setPage(p => p + 1)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors
            ${nextEnabled ? 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-sm' : 'border-gray-100 text-gray-300 cursor-not-allowed bg-white'}`}
        >
          Next
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

    </main>
  );
}
