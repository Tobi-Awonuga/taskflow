import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

function RoleBadge({ role }) {
  const cls = {
    ADMIN: 'bg-red-100 text-red-700',
    SUPER: 'bg-amber-100 text-amber-700',
    USER:  'bg-blue-100 text-blue-600',
  }[role] ?? 'bg-gray-100 text-gray-600';
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{role}</span>;
}

function StatusBadge({ active }) {
  return active
    ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Active</span>
    : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Inactive</span>;
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const INPUT_CLS =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D] transition-colors';

const SELECT_CLS =
  'border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D]';

// ── UserModal ─────────────────────────────────────────────────────────────────

function UserModal({ mode, user: editUser, departments, onClose, onSaved }) {
  const [name, setName]       = useState(editUser?.name     ?? '');
  const [email, setEmail]     = useState(editUser?.email    ?? '');
  const [password, setPass]   = useState('');
  const [role, setRole]       = useState(editUser?.role     ?? 'USER');
  const [deptId, setDeptId]   = useState(editUser?.departmentId ?? '');
  const [active, setActive]   = useState(editUser?.isActive ?? true);
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  const deptRequired = role === 'SUPER' || role === 'USER';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    if (mode === 'create') {
      if (!email.trim()) { setError('Email is required.'); return; }
      if (!password)     { setError('Password is required.'); return; }
    }
    if (deptRequired && !deptId) { setError('Department is required for this role.'); return; }

    const body = mode === 'create'
      ? { name: name.trim(), email: email.trim().toLowerCase(), password, role, departmentId: deptId ? Number(deptId) : null }
      : { name: name.trim(), role, departmentId: deptId ? Number(deptId) : null, isActive: active };

    setSaving(true);
    try {
      const res = await fetch(
        mode === 'create' ? '/api/users' : `/api/users/${editUser.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }
      onSaved();
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
          <h3 className="text-base font-bold text-gray-800">
            {mode === 'create' ? 'Add User' : 'Edit User'}
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT_CLS} />
            </div>

            {mode === 'create' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={INPUT_CLS} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500">Password</label>
                  <input type="password" value={password} onChange={e => setPass(e.target.value)} className={INPUT_CLS} autoComplete="new-password" />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className={SELECT_CLS}>
                <option value="USER">USER</option>
                <option value="SUPER">SUPER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">
                Department{deptRequired ? ' *' : ''}
              </label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)} className={SELECT_CLS}>
                {!deptRequired && <option value="">No department (org-wide)</option>}
                {deptRequired  && <option value="">Select a department…</option>}
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {mode === 'edit' && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  className="rounded"
                />
                Active
              </label>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold bg-[#F0654D] hover:bg-[#E85B44] text-white rounded-xl disabled:opacity-60">
                {saving ? 'Saving…' : mode === 'create' ? 'Add User' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: authUser } = useAuth();

  const [users, setUsers]           = useState([]);
  const [departments, setDepts]     = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(true);
  const [refetchTick, setRefetch]   = useState(0);
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActive]   = useState('');
  const [searchQ, setSearchQ]       = useState('');
  const [modal, setModal]           = useState(null);
  const [saving, setSaving]         = useState(false); // eslint-disable-line no-unused-vars
  const [error, setError]           = useState('');    // eslint-disable-line no-unused-vars

  const fetchUsers = useCallback(() => {
    setLoading(true);
    let url = `/api/users?page=${page}&pageSize=20`;
    if (roleFilter)   url += `&role=${roleFilter}`;
    if (activeFilter) url += `&isActive=${activeFilter}`;
    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { users: [], total: 0, totalPages: 1 })
      .then(d => {
        setUsers(d.users ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
      })
      .finally(() => setLoading(false));
  }, [page, roleFilter, activeFilter, refetchTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    fetch('/api/departments', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { departments: [] })
      .then(d => setDepts(d.departments ?? []));
  }, []);

  async function handleDeactivate(u) {
    if (!window.confirm(`Deactivate ${u.name}?`)) return;
    await fetch(`/api/users/${u.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setRefetch(n => n + 1);
  }

  async function handleReactivate(u) {
    await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    });
    setRefetch(n => n + 1);
  }

  const displayUsers = users.filter(u =>
    !searchQ ||
    u.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQ.toLowerCase())
  );

  const prevEnabled = page > 1 && !loading;
  const nextEnabled = page < totalPages && !loading;

  return (
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Users <span className="text-lg font-normal text-gray-400">({total})</span></h1>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 bg-[#F0654D] hover:bg-[#E85B44] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add User
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search name or email…"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D] w-56"
        />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30">
          <option value="">All Roles</option>
          <option value="ADMIN">ADMIN</option>
          <option value="SUPER">SUPER</option>
          <option value="USER">USER</option>
        </select>
        <select value={activeFilter} onChange={e => { setActive(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3.5">User</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Role</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Department</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : displayUsers.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">No users found.</td></tr>
            ) : displayUsers.map((u, idx) => {
              const dept = departments.find(d => d.id === u.departmentId);
              return (
                <tr key={u.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#F0654D] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{dept?.name ?? '—'}</td>
                  <td className="px-4 py-3.5"><StatusBadge active={u.isActive} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setModal({ mode: 'edit', user: u })}
                        className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      {u.id !== authUser?.id && (
                        u.isActive
                          ? (
                            <button
                              onClick={() => handleDeactivate(u)}
                              className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                            >
                              Deactivate
                            </button>
                          )
                          : (
                            <button
                              onClick={() => handleReactivate(u)}
                              className="text-xs text-green-500 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50"
                            >
                              Reactivate
                            </button>
                          )
                      )}
                    </div>
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

      {modal && (
        <UserModal
          mode={modal.mode}
          user={modal.user ?? null}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setRefetch(n => n + 1); }}
        />
      )}

    </main>
  );
}
