import { useState } from 'react';

export default function CreateTaskModal({ open, onClose, onSubmit, user }) {
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [priority, setPriority]         = useState('MEDIUM');
  const [dueDate, setDueDate]           = useState('');
  const [deptId, setDeptId]             = useState('');
  const [titleError, setTitleError]     = useState('');
  const [submitError, setSubmitError]   = useState('');
  const [loading, setLoading]           = useState(false);

  if (!open) return null;

  function resetForm() {
    setTitle(''); setDescription(''); setPriority('MEDIUM');
    setDueDate(''); setDeptId(''); setTitleError(''); setSubmitError(''); setLoading(false);
  }

  function handleClose() { resetForm(); onClose(); }

  async function handleSubmit(e) {
    e.preventDefault();
    setTitleError(''); setSubmitError('');
    if (!title.trim()) { setTitleError('Title is required.'); return; }

    const body = { title: title.trim(), priority };
    if (description.trim()) body.description = description.trim();
    if (dueDate) body.dueAt = new Date(dueDate + 'T00:00:00').toISOString();
    if (user.role === 'ADMIN' && deptId) body.departmentId = parseInt(deptId, 10);

    setLoading(true);
    const result = await onSubmit(body);
    setLoading(false);
    if (!result.ok) { setSubmitError(result.error); return; }
    resetForm(); onClose();
  }

  const labelClass = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1';
  const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D]';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleClose}>
      <div role="dialog" className="w-full max-w-md bg-white rounded-2xl p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800">New Task</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div>
            <label className={labelClass}>Title</label>
            <input type="text" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            {titleError && <p className="text-red-500 text-sm mt-1">{titleError}</p>}
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>

          {user.role === 'ADMIN' && (
            <div>
              <label className={labelClass}>Department ID</label>
              <input type="number" min={1} value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">Leave blank to create unscoped, or enter a department ID.</p>
            </div>
          )}

          {submitError && <p className="text-red-500 text-sm">{submitError}</p>}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={handleClose} className="text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="bg-[#F0654D] hover:bg-[#E85B44] text-white font-semibold rounded-xl px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
