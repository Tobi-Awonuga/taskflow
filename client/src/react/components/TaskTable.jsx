import { useState } from 'react';
import CancelReasonModal from './CancelReasonModal.jsx';

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

function dueBadge(dueAt, status) {
  if (!dueAt) return null;

  const isDone = status === 'DONE' || status === 'CANCELLED';
  const due    = new Date(dueAt);
  const now    = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueStart   = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays   = Math.round((dueStart - todayStart) / (1000 * 60 * 60 * 24));

  const dateLabel = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (isDone) return { label: dateLabel, cls: 'text-gray-400' };
  if (diffDays < 0)  return { label: `Overdue · ${dateLabel}`,   cls: 'text-red-500 font-semibold' };
  if (diffDays === 0) return { label: `Due today · ${dateLabel}`, cls: 'text-orange-500 font-semibold' };
  if (diffDays === 1) return { label: `Tomorrow · ${dateLabel}`,  cls: 'text-amber-500' };
  if (diffDays <= 3)  return { label: `In ${diffDays} days · ${dateLabel}`, cls: 'text-amber-500' };
  return { label: dateLabel, cls: 'text-gray-400' };
}

export default function TaskTable({ tasks, loading, onUpdateStatus, onUpdatePriority, onTaskClick }) {
  const [updatingId,       setUpdatingId]       = useState(null);
  const [updatingPrioId,   setUpdatingPrioId]   = useState(null);
  const [draftStatus,      setDraftStatus]      = useState({});
  const [draftPriority,    setDraftPriority]    = useState({});
  const [cancelTarget,     setCancelTarget]     = useState(null);

  const clearDraft  = (taskId) =>
    setDraftStatus(prev => { const next = { ...prev }; delete next[taskId]; return next; });
  const revertDraft = (taskId, original) =>
    setDraftStatus(prev => ({ ...prev, [taskId]: original }));

  const handlePriorityChange = async (task, newPriority) => {
    if (newPriority === task.priority) return;
    setDraftPriority(prev => ({ ...prev, [task.id]: newPriority }));
    setUpdatingPrioId(task.id);
    try {
      const ok = await onUpdatePriority(task.id, newPriority);
      if (!ok) setDraftPriority(prev => ({ ...prev, [task.id]: task.priority }));
      else setDraftPriority(prev => { const n = { ...prev }; delete n[task.id]; return n; });
    } finally {
      setUpdatingPrioId(null);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    if (newStatus === task.status) return;
    setDraftStatus(prev => ({ ...prev, [task.id]: newStatus }));

    if (newStatus === 'CANCELLED') {
      setCancelTarget(task);
      return;
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
      const busy            = updatingId === task.id;
      const busyPrio        = updatingPrioId === task.id;
      const displayStatus   = draftStatus[task.id]   ?? task.status;
      const displayPriority = draftPriority[task.id] ?? task.priority;
      const statusColor     = STATUS_COLOR[displayStatus]     ?? '#9CA3AF';
      const priorityColor   = PRIORITY_COLOR[displayPriority] ?? '#9CA3AF';
      return (
        <tr
          key={task.id}
          onClick={() => onTaskClick && onTaskClick(task)}
          className={`border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
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
            <div onClick={e => e.stopPropagation()}>
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
            </div>
          </td>

          <td className="px-4 py-3.5">
            <div onClick={e => e.stopPropagation()}>
              <select
                value={displayPriority}
                disabled={busyPrio}
                onChange={e => handlePriorityChange(task, e.target.value)}
                style={{ color: priorityColor, borderColor: `${priorityColor}60` }}
                className={SELECT_CLS}
              >
                {PRIORITIES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </td>

          <td className="px-4 py-3.5 whitespace-nowrap">
            {(() => {
              const badge = dueBadge(task.dueAt, task.status);
              if (!badge) return <span className="text-xs text-gray-300">—</span>;
              return <span className={`text-xs ${badge.cls}`}>{badge.label}</span>;
            })()}
          </td>
        </tr>
      );
    });
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3.5">Title</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Status</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Priority</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Due</th>
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>

      <CancelReasonModal
        open={cancelTarget !== null}
        onClose={() => { setCancelTarget(null); revertDraft(cancelTarget?.id, cancelTarget?.status); }}
        onConfirm={async (reason) => {
          const t = cancelTarget;
          setCancelTarget(null);
          setUpdatingId(t.id);
          try {
            const ok = await onUpdateStatus(t.id, 'CANCELLED', reason);
            if (!ok) revertDraft(t.id, t.status);
            else clearDraft(t.id);
          } finally {
            setUpdatingId(null);
          }
        }}
      />
    </>
  );
}
