import { useState, useEffect, useRef } from 'react';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function userInitials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function renderContent(text) {
  if (!text) return null;
  return text.split(/(@\w+)/).map((part, i) =>
    part.startsWith('@') && part.length > 1
      ? <span key={i} className="text-[#F0654D] font-medium">{part}</span>
      : part
  );
}

// ── Editable components ───────────────────────────────────────────────────────

function EditableTitle({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [saving,  setSaving]  = useState(false);
  const [failed,  setFailed]  = useState(false);

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
  const [draft,   setDraft]   = useState(value ?? '');
  const [saving,  setSaving]  = useState(false);

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

// ── TaskDetailDrawer ──────────────────────────────────────────────────────────

export default function TaskDetailDrawer({ task, onClose, onUpdateStatus, onUpdatePriority, onUpdateTask, allUsers = [], userMap = {}, user = null }) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [draftStatus,     setDraftStatus]     = useState(null);
  const [updatingStatus,  setUpdatingStatus]  = useState(false);
  const [updatingPrio,    setUpdatingPrio]    = useState(false);

  // Collaborators state
  const [collaborators,      setCollaborators]      = useState([]);
  const [collabLoading,      setCollabLoading]      = useState(false);
  const [collabPickerOpen,   setCollabPickerOpen]   = useState(false);
  const [collabSearch,       setCollabSearch]       = useState('');
  const collabPickerRef = useRef(null);

  // Comments state
  const [comments,          setComments]          = useState([]);
  const [commentsLoading,   setCommentsLoading]   = useState(false);
  const [commentDraft,      setCommentDraft]      = useState('');
  const [commentRows,       setCommentRows]       = useState(2);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [editingCommentId,  setEditingCommentId]  = useState(null);
  const [editDraft,         setEditDraft]         = useState('');
  const [editSaving,        setEditSaving]        = useState(false);
  const [menuOpenId,        setMenuOpenId]        = useState(null);

  // @ mention autocomplete
  const [mentionOpen,  setMentionOpen]  = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);

  const textareaRef = useRef(null);

  // Fetch collaborators when task changes
  useEffect(() => {
    if (!task?.id) { setCollaborators([]); return; }
    setCollabLoading(true);
    fetch(`/api/tasks/${task.id}/collaborators`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { collaborators: [] })
      .then(d => setCollaborators(d.collaborators ?? []))
      .catch(() => {})
      .finally(() => setCollabLoading(false));
  }, [task?.id]);

  // Close collaborator picker on outside click
  useEffect(() => {
    if (!collabPickerOpen) return;
    const handler = (e) => {
      if (collabPickerRef.current && !collabPickerRef.current.contains(e.target)) {
        setCollabPickerOpen(false);
        setCollabSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [collabPickerOpen]);

  useEffect(() => {
    if (!task?.id) { setComments([]); return; }
    setCommentsLoading(true);
    fetch(`/api/tasks/${task.id}/comments`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { comments: [] })
      .then(d => setComments(d.comments ?? []))
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
  }, [task?.id]);

  // Reset comment input when task changes
  useEffect(() => {
    setCommentDraft('');
    setCommentRows(2);
    setMentionOpen(false);
    setEditingCommentId(null);
    setMenuOpenId(null);
  }, [task?.id]);

  if (!task) return null;

  const displayStatus = draftStatus ?? task.status;
  const statusColor   = STATUS_COLOR[displayStatus]   ?? '#9CA3AF';
  const priorityColor = PRIORITY_COLOR[task.priority] ?? '#9CA3AF';

  // ── Status / priority handlers ──────────────────────────────────────────────

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

  // ── Collaborator handlers ────────────────────────────────────────────────────

  async function handleAddCollaborator(targetUser) {
    setCollabPickerOpen(false);
    setCollabSearch('');
    const res = await fetch(`/api/tasks/${task.id}/collaborators`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUser.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setCollaborators(prev => [...prev, {
        ...data.collaborator,
        userName:   targetUser.name,
        userEmail:  targetUser.email,
        userRole:   targetUser.role,
        userDeptId: targetUser.departmentId,
      }]);
    }
  }

  async function handleRemoveCollaborator(userId) {
    const res = await fetch(`/api/tasks/${task.id}/collaborators/${userId}`, {
      method: 'DELETE', credentials: 'include',
    });
    if (res.ok || res.status === 204) {
      setCollaborators(prev => prev.filter(c => c.userId !== userId));
    }
  }

  // ── Comment handlers ────────────────────────────────────────────────────────

  function handleCommentInput(e) {
    const val = e.target.value;
    setCommentDraft(val);

    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match  = before.match(/@(\w*)$/);

    if (match) {
      const charBefore = match.index > 0 ? before[match.index - 1] : '';
      if (!charBefore || /\s/.test(charBefore)) {
        setMentionQuery(match[1]);
        setMentionStart(match.index);
        setMentionOpen(true);
        return;
      }
    }
    setMentionOpen(false);
    setMentionStart(-1);
  }

  function insertMention(u) {
    const firstName = u.name.split(' ')[0];
    const before  = commentDraft.slice(0, mentionStart);
    const after   = commentDraft.slice(mentionStart + 1 + mentionQuery.length);
    setCommentDraft(`${before}@${firstName} ${after}`);
    setMentionOpen(false);
    setMentionStart(-1);
    textareaRef.current?.focus();
  }

  async function handleSubmitComment(e) {
    e.preventDefault();
    const trimmed = commentDraft.trim();
    if (!trimmed || commentSubmitting || trimmed.length > 5000) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => [...prev, data.comment]);
        setCommentDraft('');
        setCommentRows(2);
      }
    } catch {}
    setCommentSubmitting(false);
  }

  async function handleSaveEdit(commentId) {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments/${commentId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => prev.map(c =>
          c.id === commentId
            ? { ...c, content: data.comment.content, editedAt: data.comment.editedAt }
            : c
        ));
        setEditingCommentId(null);
      }
    } catch {}
    setEditSaving(false);
  }

  async function handleDeleteComment(commentId) {
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments/${commentId}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (res.ok) setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {}
    setMenuOpenId(null);
  }

  const filteredMentionUsers = mentionOpen
    ? allUsers.filter(u =>
        !mentionQuery ||
        u.name.toLowerCase().startsWith(mentionQuery.toLowerCase()) ||
        u.name.split(' ').some(w => w.toLowerCase().startsWith(mentionQuery.toLowerCase()))
      ).slice(0, 5)
    : [];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl flex flex-col z-40">

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
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
            <label htmlFor="drawer-assignee" className={LABEL_CLS}>Assignee</label>
            <select
              id="drawer-assignee"
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
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Collaborators */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={LABEL_CLS}>Collaborators</span>
              {(user?.role === 'ADMIN' || user?.role === 'SUPER' || task.createdByUserId === user?.id) && (
                <div ref={collabPickerRef} className="relative">
                  <button
                    type="button"
                    onClick={() => { setCollabPickerOpen(v => !v); setCollabSearch(''); }}
                    className="flex items-center gap-1 text-xs text-[#F0654D] hover:text-[#E85B44] font-semibold"
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Invite
                  </button>
                  {collabPickerOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden">
                      <div className="p-2 border-b border-gray-50">
                        <input
                          autoFocus
                          type="text"
                          value={collabSearch}
                          onChange={e => setCollabSearch(e.target.value)}
                          placeholder="Search users…"
                          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#F0654D]"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {allUsers
                          .filter(u =>
                            u.isActive !== false &&
                            !collaborators.some(c => c.userId === u.id) &&
                            u.id !== task.assignedToUserId &&
                            (!collabSearch || u.name.toLowerCase().includes(collabSearch.toLowerCase()) || u.email.toLowerCase().includes(collabSearch.toLowerCase()))
                          )
                          .slice(0, 20)
                          .map(u => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => handleAddCollaborator(u)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                            >
                              <div className="w-6 h-6 rounded-full bg-[#F0654D] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {userInitials(u.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{u.name}</p>
                                <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                              </div>
                            </button>
                          ))
                        }
                        {allUsers.filter(u =>
                          u.isActive !== false &&
                          !collaborators.some(c => c.userId === u.id) &&
                          u.id !== task.assignedToUserId &&
                          (!collabSearch || u.name.toLowerCase().includes(collabSearch.toLowerCase()) || u.email.toLowerCase().includes(collabSearch.toLowerCase()))
                        ).length === 0 && (
                          <p className="text-xs text-gray-400 px-3 py-3 text-center">No users to add</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {collabLoading && <p className="text-xs text-gray-400">Loading…</p>}

            {!collabLoading && collaborators.length === 0 && (
              <p className="text-xs text-gray-300 italic">No collaborators yet.</p>
            )}

            {!collabLoading && collaborators.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {collaborators.map(c => {
                  const canRemove =
                    user?.role === 'ADMIN' ||
                    user?.role === 'SUPER' ||
                    task.createdByUserId === user?.id ||
                    user?.id === c.userId;
                  return (
                    <div key={c.id} className="flex items-center gap-2.5 group">
                      <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {userInitials(c.userName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{c.userName}</p>
                      </div>
                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCollaborator(c.userId)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 shrink-0"
                          title="Remove collaborator"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cancel Reason */}
          {task.status === 'CANCELLED' && task.cancelReason && (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLS}>Cancel Reason</span>
              <p className="text-sm text-gray-700">{task.cancelReason}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-col gap-1 pt-1 border-t border-gray-50">
            <p className="text-xs text-gray-400">Created {formatDate(task.createdAt)}</p>
            <p className="text-xs text-gray-400">Updated {formatDate(task.updatedAt)}</p>
          </div>

          {/* ── Comments ─────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <span className={LABEL_CLS}>
              Comments{comments.length > 0 ? ` (${comments.length})` : ''}
            </span>

            {commentsLoading && (
              <p className="text-xs text-gray-400">Loading…</p>
            )}

            {!commentsLoading && comments.length === 0 && (
              <p className="text-sm text-gray-300 italic">No comments yet.</p>
            )}

            {comments.map(c => {
              const isOwn    = c.user?.id === user?.id;
              const canEdit  = isOwn || user?.role === 'ADMIN';
              const isEditing = editingCommentId === c.id;

              return (
                <div key={c.id} className="flex gap-2.5 group">
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-[#F0654D] flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5">
                    {userInitials(c.user?.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-gray-700">
                        {c.user?.name ?? 'Deleted user'}
                      </span>
                      <span className="text-xs text-gray-400">{formatRelative(c.createdAt)}</span>
                      {c.editedAt && (
                        <span className="text-xs text-gray-400">(edited)</span>
                      )}

                      {canEdit && !isEditing && (
                        <div className="relative ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setMenuOpenId(menuOpenId === c.id ? null : c.id)}
                            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-sm leading-none"
                          >
                            ⋯
                          </button>
                          {menuOpenId === c.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden min-w-[90px]">
                              <button
                                type="button"
                                onClick={() => { setEditingCommentId(c.id); setEditDraft(c.content); setMenuOpenId(null); }}
                                className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(c.id)}
                                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-1.5 flex flex-col gap-1.5">
                        <textarea
                          autoFocus
                          rows={3}
                          value={editDraft}
                          onChange={e => setEditDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Escape') setEditingCommentId(null); }}
                          className={`${FIELD_INPUT_CLS} resize-none`}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={editSaving}
                            onClick={() => handleSaveEdit(c.id)}
                            className="text-xs bg-[#F0654D] text-white px-3 py-1 rounded-lg hover:bg-[#E85B44] disabled:opacity-50"
                          >
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCommentId(null)}
                            className="text-xs text-gray-500 px-3 py-1 rounded-lg hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                        {renderContent(c.content)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* New comment form */}
            <form onSubmit={handleSubmitComment} className="flex flex-col gap-2 mt-1">
              <div className="relative">
                {mentionOpen && filteredMentionUsers.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                    {filteredMentionUsers.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-[#F0654D] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {userInitials(u.name)}
                        </div>
                        {u.name}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  rows={commentRows}
                  value={commentDraft}
                  onChange={handleCommentInput}
                  onFocus={() => setCommentRows(4)}
                  onBlur={() => { if (!commentDraft) setCommentRows(2); }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setMentionOpen(false);
                    if (e.key === 'Enter' && e.ctrlKey) handleSubmitComment(e);
                  }}
                  placeholder="Add a comment… (Ctrl+Enter to submit)"
                  className={`${FIELD_INPUT_CLS} resize-none`}
                />
              </div>
              <div className="flex items-center justify-between">
                {commentDraft.length >= 4500
                  ? <span className={`text-xs ${commentDraft.length > 5000 ? 'text-red-500' : 'text-amber-500'}`}>
                      {commentDraft.length} / 5000
                    </span>
                  : <span />
                }
                <button
                  type="submit"
                  disabled={!commentDraft.trim() || commentSubmitting || commentDraft.length > 5000}
                  className="text-xs bg-[#F0654D] text-white px-4 py-1.5 rounded-lg hover:bg-[#E85B44] disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                >
                  {commentSubmitting ? 'Posting…' : 'Comment'}
                </button>
              </div>
            </form>
          </div>

        </div>
        {/* end scrollable body */}

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
