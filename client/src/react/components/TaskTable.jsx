import { useState, useRef, useEffect } from 'react';
import CancelReasonModal from './CancelReasonModal.jsx';

// ── Config ─────────────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS = {
  TODO:        ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['TODO', 'DONE', 'BLOCKED', 'CANCELLED'],
  DONE:        ['TODO'],
  BLOCKED:     ['TODO', 'IN_PROGRESS', 'CANCELLED'],
  CANCELLED:   ['TODO'],
};

const STATUS_META = {
  TODO:        { color: '#4C8DFF', bg: '#EFF4FF', label: 'To Do' },
  IN_PROGRESS: { color: '#F4A23A', bg: '#FFF4E6', label: 'In Progress' },
  DONE:        { color: '#43B96D', bg: '#EDFAF2', label: 'Done' },
  BLOCKED:     { color: '#F05A5A', bg: '#FEF0F0', label: 'Blocked' },
  CANCELLED:   { color: '#9CA3AF', bg: '#F3F4F6', label: 'Cancelled' },
};

const PRIORITY_META = {
  LOW:    { color: '#9CA3AF', bg: '#F9FAFB', label: 'Low' },
  MEDIUM: { color: '#6366F1', bg: '#EEF2FF', label: 'Medium' },
  HIGH:   { color: '#F97316', bg: '#FFF4ED', label: 'High' },
  URGENT: { color: '#EF4444', bg: '#FEF2F2', label: 'Urgent' },
};

// ── Inline pill dropdown ────────────────────────────────────────────────────────

function InlineDropdown({ value, options, disabled, onChange, metaMap }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = metaMap[value] ?? { color: '#9CA3AF', bg: '#F3F4F6', label: value };

  return (
    <div ref={ref} className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 active:scale-95"
        style={{ color: current.color, backgroundColor: current.bg }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: current.color }} />
        {current.label}
        {!disabled && (
          <svg
            width="9" height="9" viewBox="0 0 9 9" fill="none"
            className={`ml-0.5 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M2 3l2.5 2.5L7 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[148px]">
          {options.map(opt => {
            const meta = metaMap[opt] ?? { color: '#9CA3AF', bg: '#F3F4F6', label: opt };
            const isActive = opt === value;
            return (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                disabled={isActive}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-50 disabled:cursor-default"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                <span style={{ color: meta.color }}>{meta.label}</span>
                {isActive && (
                  <svg className="ml-auto shrink-0" width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 5.5l2.5 2.5 4.5-4.5" stroke={meta.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Due date badge ──────────────────────────────────────────────────────────────

function dueBadge(dueAt, status) {
  if (!dueAt) return null;
  const isDone     = status === 'DONE' || status === 'CANCELLED';
  const due        = new Date(dueAt);
  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueStart   = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays   = Math.round((dueStart - todayStart) / (1000 * 60 * 60 * 24));
  const dateLabel  = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (isDone)         return { label: dateLabel,                          cls: 'text-gray-400' };
  if (diffDays < 0)   return { label: `Overdue · ${dateLabel}`,          cls: 'text-red-500 font-semibold' };
  if (diffDays === 0) return { label: `Due today · ${dateLabel}`,        cls: 'text-orange-500 font-semibold' };
  if (diffDays === 1) return { label: `Tomorrow · ${dateLabel}`,         cls: 'text-amber-500' };
  if (diffDays <= 3)  return { label: `In ${diffDays} days · ${dateLabel}`, cls: 'text-amber-500' };
  return { label: dateLabel, cls: 'text-gray-400' };
}

// ── TaskTable ───────────────────────────────────────────────────────────────────

export default function TaskTable({ tasks, loading, onUpdateStatus, onUpdatePriority, onTaskClick, userMap = {} }) {
  const [updatingId,     setUpdatingId]     = useState(null);
  const [updatingPrioId, setUpdatingPrioId] = useState(null);
  const [draftStatus,    setDraftStatus]    = useState({});
  const [draftPriority,  setDraftPriority]  = useState({});
  const [cancelTarget,   setCancelTarget]   = useState(null);

  const clearDraft  = (id) => setDraftStatus(p => { const n = { ...p }; delete n[id]; return n; });
  const revertDraft = (id, orig) => setDraftStatus(p => ({ ...p, [id]: orig }));

  const handleStatusChange = async (task, newStatus) => {
    if (newStatus === task.status) return;
    setDraftStatus(p => ({ ...p, [task.id]: newStatus }));
    if (newStatus === 'CANCELLED') { setCancelTarget(task); return; }
    setUpdatingId(task.id);
    try {
      const ok = await onUpdateStatus(task.id, newStatus);
      if (!ok) revertDraft(task.id, task.status);
      else clearDraft(task.id);
    } finally { setUpdatingId(null); }
  };

  const handlePriorityChange = async (task, newPriority) => {
    if (newPriority === task.priority) return;
    setDraftPriority(p => ({ ...p, [task.id]: newPriority }));
    setUpdatingPrioId(task.id);
    try {
      const ok = await onUpdatePriority(task.id, newPriority);
      if (!ok) setDraftPriority(p => ({ ...p, [task.id]: task.priority }));
      else setDraftPriority(p => { const n = { ...p }; delete n[task.id]; return n; });
    } finally { setUpdatingPrioId(null); }
  };

  let body;

  if (loading) {
    body = Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="border-b border-gray-100 last:border-0">
        <td className="px-5 py-4">
          <div className="h-4 bg-gray-100 rounded animate-pulse w-48 mb-1.5" />
          <div className="h-3 bg-gray-50 rounded animate-pulse w-24" />
        </td>
        <td className="px-4 py-4"><div className="h-6 bg-gray-100 rounded-full animate-pulse w-20" /></td>
        <td className="px-4 py-4"><div className="h-6 bg-gray-100 rounded-full animate-pulse w-16" /></td>
        <td className="px-4 py-4"><div className="h-5 bg-gray-100 rounded-full animate-pulse w-24" /></td>
      </tr>
    ));
  } else if (tasks.length === 0) {
    body = (
      <tr>
        <td colSpan={4}>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-gray-200">
              <rect x="6" y="8" width="28" height="26" rx="3" stroke="currentColor" strokeWidth="2" />
              <path d="M13 20h14M13 26h8M13 14h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-medium text-gray-500">No tasks found</p>
            <p className="text-xs text-gray-400">Try adjusting your filters or search term</p>
          </div>
        </td>
      </tr>
    );
  } else {
    body = tasks.map((task) => {
      const busy            = updatingId === task.id;
      const busyPrio        = updatingPrioId === task.id;
      const displayStatus   = draftStatus[task.id]   ?? task.status;
      const displayPriority = draftPriority[task.id] ?? task.priority;
      const statusOptions   = [displayStatus, ...(ALLOWED_TRANSITIONS[displayStatus] ?? [])];
      const isOverdue       = task.dueAt &&
        new Date(task.dueAt) < new Date() &&
        displayStatus !== 'DONE' && displayStatus !== 'CANCELLED';

      return (
        <tr
          key={task.id}
          onClick={() => onTaskClick?.(task)}
          className="border-b border-gray-100 last:border-0 hover:bg-[#F0654D]/[0.02] transition-colors duration-100 cursor-pointer"
        >
          <td className="px-5 py-3.5">
            <span className="text-sm font-medium text-gray-800">{task.title}</span>
            {task.assignedToUserId && (
              <span className="block text-xs text-gray-400 mt-0.5">
                {userMap[task.assignedToUserId]?.name ?? `User #${task.assignedToUserId}`}
              </span>
            )}
          </td>

          <td className="px-4 py-3.5">
            <InlineDropdown
              value={displayStatus}
              options={statusOptions}
              disabled={busy}
              onChange={v => handleStatusChange(task, v)}
              metaMap={STATUS_META}
            />
          </td>

          <td className="px-4 py-3.5">
            <InlineDropdown
              value={displayPriority}
              options={Object.keys(PRIORITY_META)}
              disabled={busyPrio}
              onChange={v => handlePriorityChange(task, v)}
              metaMap={PRIORITY_META}
            />
          </td>

          <td className="px-4 py-3.5 whitespace-nowrap">
            {(() => {
              const badge = dueBadge(task.dueAt, task.status);
              if (!badge) return <span className="text-xs text-gray-300">—</span>;
              const pillBg = isOverdue ? 'bg-red-50' : badge.cls.includes('orange') ? 'bg-orange-50' : badge.cls.includes('amber') ? 'bg-amber-50' : 'bg-gray-50';
              return (
                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${pillBg} ${badge.cls} ${isOverdue ? 'animate-pulse' : ''}`}>
                  {badge.label}
                </span>
              );
            })()}
          </td>
        </tr>
      );
    });
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-5 py-3">Title</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Status</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Priority</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Due</th>
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
          } finally { setUpdatingId(null); }
        }}
      />
    </>
  );
}
