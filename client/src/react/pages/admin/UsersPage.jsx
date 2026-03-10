import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_PILL = {
  ADMIN: 'bg-purple-100 text-purple-700',
  SUPER: 'bg-blue-100 text-blue-700',
  USER:  'bg-gray-100 text-gray-600',
};

const FILTER_CLS =
  'appearance-none border border-gray-200 rounded-xl px-3 py-2 pr-8 text-sm text-gray-700 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D] cursor-pointer';

const MODAL_INPUT =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D] transition-colors';

const MODAL_LABEL = 'text-xs font-semibold text-gray-500 uppercase tracking-wider';

const EYE_ON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EYE_OFF = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ── Small components ──────────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-28 bg-gray-200 animate-pulse rounded" />
            <div className="h-2.5 w-36 bg-gray-100 animate-pulse rounded" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden sm:table-cell"><div className="h-3 w-40 bg-gray-100 animate-pulse rounded" /></td>
      <td className="px-4 py-3.5"><div className="h-5 w-14 bg-gray-200 animate-pulse rounded-full" /></td>
      <td className="px-4 py-3.5 hidden md:table-cell"><div className="h-3 w-24 bg-gray-100 animate-pulse rounded" /></td>
      <td className="px-4 py-3.5"><div className="h-5 w-14 bg-gray-200 animate-pulse rounded-full" /></td>
      <td className="px-4 py-3.5"><div className="h-6 w-20 bg-gray-100 animate-pulse rounded-lg ml-auto" /></td>
    </tr>
  );
}

// ── AddUserModal ──────────────────────────────────────────────────────────────

function AddUserModal({ departments, onClose, onCreated }) {
  const [name,     setName]   = useState('');
  const [email,    setEmail]  = useState('');
  const [password, setPass]   = useState('');
  const [showPw,   setShowPw] = useState(false);
  const [role,     setRole]   = useState('USER');
  const [deptId,   setDeptId] = useState('');
  const [error,    setError]  = useState('');
  const [saving,   setSaving] = useState(false);

  const deptRequired = role !== 'ADMIN';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim())        { setError('Full name is required.'); return; }
    if (!email.trim())       { setError('Email is required.'); return; }
    if (!password)           { setError('Password is required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (deptRequired && !deptId) { setError('Department is required for this role.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         name.trim(),
          email:        email.trim(),
          password,
          role,
          departmentId: deptId ? parseInt(deptId, 10) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 409 ? 'This email is already in use.' : (data.error ?? 'Something went wrong.'));
        return;
      }
      onCreated(data);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Add New User</h2>
              <p className="text-xs text-gray-400 mt-0.5">Fill in the details below to create an account.</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5 overflow-y-auto">

            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-user-name" className={MODAL_LABEL}>Full Name <span className="text-[#F0654D]">*</span></label>
              <input
                id="add-user-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                placeholder="Jane Smith"
                className={MODAL_INPUT}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-user-email" className={MODAL_LABEL}>Email <span className="text-[#F0654D]">*</span></label>
              <input
                id="add-user-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className={MODAL_INPUT}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-user-password" className={MODAL_LABEL}>Password <span className="text-[#F0654D]">*</span></label>
              <div className="relative">
                <input
                  id="add-user-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPass(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={`${MODAL_INPUT} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? EYE_OFF : EYE_ON}
                </button>
              </div>
              <p className="text-xs text-gray-400">User can change this after first login.</p>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="add-user-role" className={MODAL_LABEL}>Role</label>
                <select
                  id="add-user-role"
                  value={role}
                  onChange={e => { setRole(e.target.value); setDeptId(''); }}
                  className={MODAL_INPUT}
                >
                  <option value="USER">User</option>
                  <option value="SUPER">Super</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="add-user-dept" className={MODAL_LABEL}>
                  Department{deptRequired && <span className="text-[#F0654D]"> *</span>}
                </label>
                <select
                  id="add-user-dept"
                  value={deptId}
                  onChange={e => setDeptId(e.target.value)}
                  className={MODAL_INPUT}
                >
                  {deptRequired
                    ? <option value="">Select department…</option>
                    : <option value="">Org-wide</option>
                  }
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#F0654D] hover:bg-[#E85B44] rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
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
                  Add User
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: authUser } = useAuth();

  const [users,         setUsers]        = useState([]);
  const [departments,   setDepts]        = useState([]);
  const [total,         setTotal]        = useState(0);
  const [page,          setPage]         = useState(1);
  const [totalPages,    setTotalPages]   = useState(1);
  const [loading,       setLoading]      = useState(true);
  const [roleFilter,    setRoleFilter]   = useState('');
  const [statusFilter,  setStatus]       = useState('');
  const [refetchTick,   setRefetch]      = useState(0);
  const [showCreate,    setShowCreate]   = useState(false);

  // Inline editing state
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [nameDraft,     setNameDraft]     = useState('');
  const [editingDeptId, setEditingDeptId] = useState(null);

  // Fetch users
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ page, pageSize: 20 });
    if (roleFilter)   params.set('role', roleFilter);
    if (statusFilter) params.set('isActive', statusFilter);
    fetch(`/api/users?${params}`, { credentials: 'include', signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { users: [], total: 0, totalPages: 1 })
      .then(d => {
        setUsers(d.users ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [page, roleFilter, statusFilter, refetchTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch departments once on mount
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/departments', { credentials: 'include', signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { departments: [] })
      .then(d => setDepts(d.departments ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // ── Mutation handlers ────────────────────────────────────────────────────────

  async function handleRoleChange(userId, newRole) {
    setEditingRoleId(null);
    const prev = users.find(u => u.id === userId);
    setUsers(list => list.map(u => u.id === userId ? { ...u, role: newRole } : u));
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      setUsers(list => list.map(u => u.id === userId ? { ...u, role: prev.role } : u));
    }
  }

  async function handleToggleActive(userId) {
    const prev = users.find(u => u.id === userId);
    const newActive = !prev.isActive;
    setUsers(list => list.map(u => u.id === userId ? { ...u, isActive: newActive } : u));
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: newActive }),
    });
    if (!res.ok) {
      setUsers(list => list.map(u => u.id === userId ? { ...u, isActive: prev.isActive } : u));
    }
  }

  async function handleNameSave(userId) {
    const trimmed = nameDraft.trim();
    setEditingNameId(null);
    if (!trimmed) return;
    const prev = users.find(u => u.id === userId);
    if (trimmed === prev.name) return;
    setUsers(list => list.map(u => u.id === userId ? { ...u, name: trimmed } : u));
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      setUsers(list => list.map(u => u.id === userId ? { ...u, name: prev.name } : u));
    }
  }

  async function handleDeptChange(userId, newDeptId) {
    setEditingDeptId(null);
    const prev = users.find(u => u.id === userId);
    const deptId = newDeptId ? parseInt(newDeptId, 10) : null;
    setUsers(list => list.map(u => u.id === userId ? { ...u, departmentId: deptId } : u));
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentId: deptId }),
    });
    if (!res.ok) {
      setUsers(list => list.map(u => u.id === userId ? { ...u, departmentId: prev.departmentId } : u));
    }
  }

  function handleCreated() {
    setShowCreate(false);
    setPage(1);
    setRefetch(n => n + 1);
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const from = total === 0 ? 0 : (page - 1) * 20 + 1;
  const to   = Math.min(page * 20, total);
  const prevEnabled = page > 1 && !loading;
  const nextEnabled = page < totalPages && !loading;

  function deptName(departmentId) {
    return departments.find(d => d.id === departmentId)?.name ?? (departmentId ? `Dept #${departmentId}` : 'Org-wide');
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto animate-page-enter">

      {/* Header */}
      <div className="pb-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <span className="text-sm font-semibold bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">{total}</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#F0654D] hover:bg-[#E85B44] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          style={{ boxShadow: '0 2px 8px rgba(240,101,77,0.3)' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New User
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className={FILTER_CLS}
          >
            <option value="">All Roles</option>
            <option value="USER">User</option>
            <option value="SUPER">Super</option>
            <option value="ADMIN">Admin</option>
          </select>
          <ChevronDown />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className={FILTER_CLS}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <ChevronDown />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/[0.04] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-5 py-3">Name</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 hidden sm:table-cell">Email</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Role</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 hidden md:table-cell">Department</th>
              <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <svg className="mx-auto mb-3 text-gray-300" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="9" cy="7" r="4" />
                    <path d="M3 20c0-3.866 2.686-7 6-7" />
                    <path d="M16 15h6M19 12v6" />
                  </svg>
                  <p className="text-sm text-gray-400">No users found</p>
                </td>
              </tr>
            ) : users.map(u => {
              const isSelf        = u.id === authUser?.id;
              const isEditingRole = editingRoleId === u.id;
              const isEditingName = editingNameId === u.id;
              const isEditingDept = editingDeptId === u.id;

              return (
                <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors duration-100">

                  {/* Name — click to edit */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#F0654D] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(u.name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        {isEditingName ? (
                          <input
                            autoFocus
                            value={nameDraft}
                            onChange={e => setNameDraft(e.target.value)}
                            onBlur={() => handleNameSave(u.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  { e.preventDefault(); handleNameSave(u.id); }
                              if (e.key === 'Escape') { setEditingNameId(null); }
                            }}
                            className="text-sm font-semibold text-gray-800 w-full border-b border-[#F0654D] focus:outline-none bg-transparent"
                          />
                        ) : (
                          <p
                            onClick={() => { setEditingNameId(u.id); setNameDraft(u.name); }}
                            title="Click to edit name"
                            className="text-sm font-semibold text-gray-800 truncate cursor-text hover:text-[#F0654D] transition-colors"
                          >
                            {u.name}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 truncate sm:hidden">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3.5 text-sm text-gray-500 hidden sm:table-cell">{u.email}</td>

                  {/* Role — clickable pill */}
                  <td className="px-4 py-3.5">
                    {isEditingRole ? (
                      <select
                        autoFocus
                        defaultValue={u.role}
                        onBlur={() => setEditingRoleId(null)}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-[#F0654D]"
                      >
                        <option value="USER">User</option>
                        <option value="SUPER">Super</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    ) : (
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => !isSelf && setEditingRoleId(u.id)}
                        title={isSelf ? 'Cannot change your own role' : 'Click to change role'}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_PILL[u.role] ?? 'bg-gray-100 text-gray-600'} ${!isSelf ? 'hover:opacity-75 cursor-pointer' : 'cursor-default'}`}
                      >
                        {u.role}
                      </button>
                    )}
                  </td>

                  {/* Department — clickable, inline select */}
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    {isEditingDept && !isSelf ? (
                      <select
                        autoFocus
                        defaultValue={u.departmentId ?? ''}
                        onBlur={() => setEditingDeptId(null)}
                        onChange={e => handleDeptChange(u.id, e.target.value)}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-[#F0654D]"
                      >
                        <option value="">Org-wide (none)</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => !isSelf && setEditingDeptId(u.id)}
                        title={isSelf ? undefined : 'Click to change department'}
                        className={`text-sm text-left ${isSelf ? 'text-gray-500 cursor-default' : 'text-gray-500 hover:text-gray-800 cursor-pointer'}`}
                      >
                        {deptName(u.departmentId)}
                      </button>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />Inactive
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right">
                    {isSelf ? (
                      <span className="text-xs text-gray-300">—</span>
                    ) : u.isActive ? (
                      <button
                        onClick={() => handleToggleActive(u.id)}
                        className="text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleActive(u.id)}
                        className="text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 px-3 py-1 rounded-lg transition-colors"
                      >
                        Activate
                      </button>
                    )}
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {total === 0 ? 'No users' : `Showing ${from}–${to} of ${total} users`}
        </span>
        <div className="flex items-center gap-2">
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
      </div>

      {showCreate && (
        <AddUserModal
          departments={departments}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

    </main>
  );
}
