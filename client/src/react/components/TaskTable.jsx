import { useState } from 'react';

const STATUSES = [
  { value: 'TODO',        label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE',        label: 'Done' },
  { value: 'CANCELLED',   label: 'Cancelled' },
];

const PRIORITIES = [
  { value: 'LOW',    label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH',   label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const STATUS_COLOR = {
  TODO:        '#4C8DFF',
  IN_PROGRESS: '#F4A23A',
  DONE:        '#43B96D',
  BLOCKED:     '#F05A5A',
  CANCELLED:   '#9CA3AF',
};

const PRIORITY_COLOR = {
  LOW:    '#9CA3AF',
  MEDIUM: '#6B7280',
  HIGH:   '#F97316',
  URGENT: '#EF4444',
};

const SELECT_CLS =
  'text-xs rounded-lg border px-2 py-1 bg-white focus:outline-none ' +
  'focus:ring-2 focus:ring-[#F0654D]/20 focus:border-[#F0654D] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function TaskTable({ tasks, loading, onUpdateStatus }) {
  const [updatingId,  setUpdatingId]  = useState(null);
  const [draftStatus, setDraftStatus] = useState({});

  const clearDraft  = (taskId) =>
    setDraftStatus(prev => { const next = { ...prev }; delete next[taskId]; return next; });
  const revertDraft = (taskId, original) =>
    setDraftStatus(prev => ({ ...prev, [taskId]: original }));

  const handleStatusChange = async (task, newStatus) => {
    if (newStatus === task.status) return;
    setDraftStatus(prev => ({ ...prev, [task.id]: newStatus }));

    if (newStatus === 'CANCELLED') {
      const reason = window.prompt('Reason for cancellation:');
      if (reason === null || reason.trim() === '') {
        revertDraft(task.id, task.status);
        return;
      }
      setUpdatingId(task.id);
      try {
        const ok = await onUpdateStatus(task.id, newStatus, reason.trim());
        if (!ok) revertDraft(task.id, task.status);
        else clearDraft(task.id);
      } finally {
        setUpdatingId(null);
      }
    } else {
      setUpdatingId(task.id);
      try {
        const ok = await onUpdateStatus(task.id, newStatus);
        if (!ok) revertDraft(task.id, task.status);
        else clearDraft(task.id);
      } finally {
        setUpdatingId(null);
      }
    }
  };


  let body;

  if (loading) {
    body = (
      <tr>
        <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
          Loading…
        </td>
      </tr>
    );
  } else if (tasks.length === 0) {
    body = (
      <tr>
        <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
          No tasks found.
        </td>
      </tr>
    );
  } else {
    body = tasks.map((task, idx) => {
      const busy          = updatingId === task.id;
      const displayStatus = draftStatus[task.id] ?? task.status;
      const statusColor   = STATUS_COLOR[displayStatus]   ?? '#9CA3AF';
      const priorityColor = PRIORITY_COLOR[task.priority] ?? '#9CA3AF';
      return (
        <tr
          key={task.id}
          className={`border-b border-gray-50 hover:bg-orange-50/40 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
        >
          <td className="px-5 py-3.5">
            <span className="text-sm font-medium text-gray-800">{task.title}</span>
            {task.assignedToUserId && (
              <span className="block text-xs text-gray-400 mt-0.5">
                User #{task.assignedToUserId}
              </span>
            )}
          </td>

          <td className="px-4 py-3.5">
            <select
              value={displayStatus}
              disabled={busy}
              onChange={e => handleStatusChange(task, e.target.value)}
              style={{ color: statusColor, borderColor: `${statusColor}60` }}
              className={SELECT_CLS}
            >
              {STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </td>

          <td className="px-4 py-3.5">
            <select
              value={task.priority}
              disabled
              title="Priority editing coming soon"
              style={{ color: priorityColor }}
              className={SELECT_CLS}
            >
              {PRIORITIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </td>

          <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
            {formatDate(task.updatedAt)}
          </td>
        </tr>
      );
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3.5">Title</th>
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Status</th>
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Priority</th>
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Updated</th>
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}
