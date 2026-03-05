import { useState } from 'react';
import CancelReasonModal from './CancelReasonModal.jsx';

const STATUSES = [
  { value: 'TODO',        label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE',        label: 'Done' },
  { value: 'BLOCKED',     label: 'Blocked' },
  { value: 'CANCELLED',   label: 'Cancelled' },
];

const ALLOWED_TRANSITIONS = {
  TODO:        ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['TODO', 'DONE', 'BLOCKED', 'CANCELLED'],
  DONE:        ['TODO'],
  BLOCKED:     ['TODO', 'IN_PROGRESS', 'CANCELLED'],
  CANCELLED:   ['TODO'],
};

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

const LABEL_CLS = 'text-xs font-semibold text-gray-400 uppercase tracking-wider';

const FIELD_INPUT_CLS =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D] transition-colors';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Editable field (click-to-edit) ─────────────────────────────────────────

function EditableTitle({ value, onSave }) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(value);
  const [saving, setSaving]     = useState(false);
  const [failed, setFailed]     = useState(false);

  async function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) { setEditing(false); setDraft(value); return; }
    setSaving(true);
    const result = await onSave(trimmed);
    setSaving(false);
    if (!result.ok) { setFailed(true); setDraft(value); setTimeout(() => setFailed(false), 2000); }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { setEditing(false); setDraft(value); } }}
        className="text-lg font-bold text-gray-800 w-full border-b border-[#F0654D] focus:outline-none bg-transparent pb-0.5"
      />
    );
  }

  return (
    <h2
      onClick={() => { setEditing(true); setDraft(value); }}
      title="Click to edit"
      className={`text-lg font-bold cursor-text select-none leading-snug ${failed ? 'text-red-400' : 'text-gray-800'} ${saving ? 'opacity-50' : ''}`}
    >
      {saving ? 'Saving…' : value}
    </h2>
  );
}

function EditableDescription({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value ?? '');
  const [saving, setSaving]   = useState(false);

  async function commit() {
    const trimmed = draft.trim();
    if (trimmed === (value ?? '').trim()) { setEditing(false); return; }
    setSaving(true);
    await onSave(trimmed);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        rows={4}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value ?? ''); } }}
        className={`${FIELD_INPUT_CLS} resize-none`}
        placeholder="Add a description…"
      />
    );
  }

  return (
    <p
      onClick={() => { setEditing(true); setDraft(value ?? ''); }}
      title="Click to edit"
      className={`text-sm cursor-text min-h-[2.5rem] ${value ? 'text-gray-700' : 'text-gray-300 italic'} ${saving ? 'opacity-50' : ''}`}
    >
      {saving ? 'Saving…' : (value || 'Add a description…')}
    </p>
  );
}

// ── TaskDetailDrawer ────────────────────────────────────────────────────────

export default function TaskDetailDrawer({ task, onClose, onUpdateStatus, onUpdatePriority, onUpdateTask, allUsers = [], userMap = {}, user = null }) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [draftStatus,     setDraftStatus]     = useState(null);
  const [updatingStatus,  setUpdatingStatus]  = useState(false);
  const [updatingPrio,    setUpdatingPrio]    = useState(false);

  if (!task) return null;

  const displayStatus   = draftStatus ?? task.status;
  const statusColor     = STATUS_COLOR[displayStatus]  ?? '#9CA3AF';
  const priorityColor   = PRIORITY_COLOR[task.priority] ?? '#9CA3AF';

  async function handleStatusChange(newStatus) {
    if (newStatus === task.status) return;
    if (newStatus === 'CANCELLED') {
      setDraftStatus('CANCELLED');
      setShowCancelModal(true);
      return;
    }
    setDraftStatus(newStatus);
    setUpdatingStatus(true);
    const ok = await onUpdateStatus(task.id, newStatus);
    setUpdatingStatus(false);
    if (!ok) setDraftStatus(task.status);
    else setDraftStatus(null);
  }

  async function handlePriorityChange(newPriority) {
    if (newPriority === task.priority) return;
    setUpdatingPrio(true);
    await onUpdatePriority(task.id, newPriority);
    setUpdatingPrio(false);
  }

  async function handleDueDateChange(value) {
    const dueAt = value ? new Date(value + 'T00:00:00').toISOString() : null;
    await onUpdateTask(task.id, { dueAt });
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl flex flex-col z-40 translate-x-0 transition-transform duration-200">

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <EditableTitle
              value={task.title}
              onSave={(title) => onUpdateTask(task.id, { title })}
            />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0 mt-0.5"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* Status + Priority */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLS}>Status</span>
              <div onClick={e => e.stopPropagation()}>
                <select
                  value={displayStatus}
                  disabled={updatingStatus}
                  onChange={e => handleStatusChange(e.target.value)}
                  style={{ color: statusColor, borderColor: `${statusColor}60` }}
                  className={SELECT_CLS}
                >
                  {STATUSES.filter(s =>
                    s.value === displayStatus ||
                    (ALLOWED_TRANSITIONS[task.status] ?? []).includes(s.value)
                  ).map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLS}>Priority</span>
              <div onClick={e => e.stopPropagation()}>
                <select
                  value={task.priority}
                  disabled={updatingPrio}
                  onChange={e => handlePriorityChange(e.target.value)}
                  style={{ color: priorityColor, borderColor: `${priorityColor}60` }}
                  className={SELECT_CLS}
                >
                  {PRIORITIES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <span className={LABEL_CLS}>Description</span>
            <EditableDescription
              value={task.description}
              onSave={(description) => onUpdateTask(task.id, { description })}
            />
          </div>

          {/* Due Date */}
          <div className="flex flex-col gap-1.5">
            <span className={LABEL_CLS}>Due Date</span>
            <input
              type="date"
              value={task.dueAt ? task.dueAt.slice(0, 10) : ''}
              onChange={e => handleDueDateChange(e.target.value)}
              className={FIELD_INPUT_CLS}
            />
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1.5">
            <span className={LABEL_CLS}>Assignee</span>
            <select
              value={task.assignedToUserId ?? ''}
              onChange={e => {
                const val = e.target.value;
                onUpdateTask(task.id, { assignedToUserId: val ? parseInt(val, 10) : null });
              }}
              className={SELECT_CLS}
              disabled={task.status === 'DONE' || task.status === 'CANCELLED'}
            >
              <option value="">Unassigned</option>
              {(user?.role === 'USER'
                ? allUsers.filter(u => u.id === user.id)
                : allUsers
              ).map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* Cancel Reason — only when cancelled */}
          {task.status === 'CANCELLED' && task.cancelReason && (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLS}>Cancel Reason</span>
              <p className="text-sm text-gray-700">{task.cancelReason}</p>
            </div>
          )}

        </div>

        {/* Metadata footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex flex-col gap-1">
          <p className="text-xs text-gray-400">Created {formatDate(task.createdAt)}</p>
          <p className="text-xs text-gray-400">Updated {formatDate(task.updatedAt)}</p>
        </div>

      </div>

      {/* Cancel reason modal */}
      <CancelReasonModal
        open={showCancelModal}
        onClose={() => { setShowCancelModal(false); setDraftStatus(task.status); }}
        onConfirm={async (reason) => {
          setShowCancelModal(false);
          await onUpdateStatus(task.id, 'CANCELLED', reason);
          setDraftStatus(null);
        }}
      />
    </>
  );
}
