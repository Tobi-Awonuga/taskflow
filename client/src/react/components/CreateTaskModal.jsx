import { useState, useEffect } from 'react';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const labelClass    = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5';
const inputClass    = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D] transition-colors';
const inputErrClass = 'w-full border border-red-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-300/30 focus:border-red-400 transition-colors';

export default function CreateTaskModal({ open, onClose, onSubmit, user }) {
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [priority, setPriority]   = useState('MEDIUM');
  const [dueDate, setDueDate]     = useState('');
  const [assigneeId, setAssignee] = useState('');
  const [deptId, setDeptId]       = useState('');

  const [allUsers, setAllUsers]       = useState([]);
  const [departments, setDepts]       = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [titleError, setTitleError]   = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting]   = useState(false);

  // Fetch supporting data when modal opens
  useEffect(() => {
    if (!open) return;
    setDataLoading(true);
    const fetches = [
      fetch('/api/users?pageSize=100', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { users: [] })
        .then(d => setAllUsers(d.users)),
    ];
    if (user.role === 'ADMIN') {
      fetches.push(
        fetch('/api/departments', { credentials: 'include' })
          .then(r => r.ok ? r.json() : { departments: [] })
          .then(d => setDepts(d.departments))
      );
    }
    Promise.all(fetches).finally(() => setDataLoading(false));
  }, [open, user.role]);

  if (!open) return null;

  // Assignee options scoped by role
  const assignableUsers = user.role === 'USER'
    ? allUsers.filter(u => u.id === user.id)
    : user.role === 'SUPER'
      ? allUsers.filter(u => u.departmentId === user.departmentId)
      : user.role === 'ADMIN' && deptId
        ? allUsers.filter(u => u.departmentId === parseInt(deptId, 10))
        : allUsers;

  function handleDeptChange(val) {
    setDeptId(val);
    // Clear assignee if no longer in the new dept
    if (val && assigneeId) {
      const still = allUsers.find(
        u => String(u.id) === assigneeId && u.departmentId === parseInt(val, 10)
      );
      if (!still) setAssignee('');
    }
  }

  function resetForm() {
    setTitle(''); setDesc(''); setPriority('MEDIUM'); setDueDate('');
    setAssignee(''); setDeptId(''); setTitleError(''); setSubmitError('');
    setSubmitting(false);
  }

  function handleClose() { resetForm(); onClose(); }

  async function handleSubmit(e) {
    e.preventDefault();
    setTitleError(''); setSubmitError('');

    if (!title.trim()) { setTitleError('Title is required.'); return; }

    const body = { title: title.trim(), priority };
    if (description.trim())  body.description      = description.trim();
    if (dueDate)              body.dueAt            = new Date(dueDate + 'T00:00:00').toISOString();
    if (assigneeId)           body.assignedToUserId = parseInt(assigneeId, 10);
    if (user.role === 'ADMIN' && deptId) body.departmentId = parseInt(deptId, 10);

    setSubmitting(true);
    const result = await onSubmit(body);
    setSubmitting(false);

    if (!result.ok) { setSubmitError(result.error); return; }
    resetForm(); onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">New Task</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5 overflow-y-auto">

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass}>Title <span className="text-[#F0654D]">*</span></label>
              <span className={`text-xs ${title.length > 180 ? 'text-orange-400' : 'text-gray-400'}`}>
                {title.length}/200
              </span>
            </div>
            <input
              type="text"
              maxLength={200}
              placeholder="What needs to be done?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={titleError ? inputErrClass : inputClass}
              autoFocus
            />
            {titleError && <p className="text-red-500 text-xs mt-1.5">{titleError}</p>}
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              rows={3}
              placeholder="Add more details…"
              value={description}
              onChange={e => setDesc(e.target.value)}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Priority + Due Date — two columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Priority <span className="text-[#F0654D]">*</span></label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className={inputClass}
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className={labelClass}>Assignee</label>
            <select
              value={assigneeId}
              onChange={e => setAssignee(e.target.value)}
              className={inputClass}
              disabled={dataLoading}
            >
              <option value="">
                {dataLoading ? 'Loading…' : 'Unassigned'}
              </option>
              {assignableUsers.map(u => (
                <option key={u.id} value={String(u.id)}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Department — ADMIN only */}
          {user.role === 'ADMIN' && (
            <div>
              <label className={labelClass}>Department</label>
              <select
                value={deptId}
                onChange={e => handleDeptChange(e.target.value)}
                className={inputClass}
                disabled={dataLoading}
              >
                <option value="">Org-wide (no department)</option>
                {departments.map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1.5">
                Leave as Org-wide to make this task visible to everyone.
              </p>
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm">{submitError}</p>
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-task-form"
            disabled={submitting || dataLoading}
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#F0654D] hover:bg-[#E85B44] rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Creating…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Create Task
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
