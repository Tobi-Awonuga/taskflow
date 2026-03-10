import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const cls = {
    ADMIN: 'bg-purple-100 text-purple-700',
    SUPER: 'bg-blue-100 text-blue-700',
    USER:  'bg-gray-100 text-gray-500',
  }[role] ?? 'bg-gray-100 text-gray-600';
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{role}</span>;
}

function StatusBadge({ active }) {
  return active
    ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />Active
      </span>
    : <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />Inactive
      </span>;
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── New Department Modal ───────────────────────────────────────────────────────

function NewDeptModal({ onClose, onSaved }) {
  const [name, setName]     = useState('');
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }
      onSaved(data);
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-800">New Department</h3>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              autoFocus
              type="text"
              placeholder="Department name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D]"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg border border-gray-200">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold bg-[#F0654D] hover:bg-[#E85B44] text-white rounded-xl disabled:opacity-60">
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ── ADMIN view ────────────────────────────────────────────────────────────────

function AdminView() {
  const [depts, setDepts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [membersMap, setMembersMap] = useState({});
  const [loadingMem, setLoadingMem] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [refetch, setRefetch]       = useState(0);
  const [editingId, setEditingId]   = useState(null);
  const [editDraft, setEditDraft]   = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setMembersMap({});
    fetch('/api/departments', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { departments: [] })
      .then(d => setDepts(d.departments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refetch]);

  useEffect(() => {
    if (!expandedId || membersMap[expandedId]) { setLoadingMem(false); return; }
    setLoadingMem(true);
    fetch(`/api/users?departmentId=${expandedId}&pageSize=200`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { users: [] })
      .then(d => setMembersMap(m => ({ ...m, [expandedId]: d.users ?? [] })))
      .catch(() => setMembersMap(m => ({ ...m, [expandedId]: [] })))
      .finally(() => setLoadingMem(false));
  }, [expandedId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggle(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  async function handleRename(deptId) {
    const trimmed = editDraft.trim();
    setEditingId(null);
    if (!trimmed) return;
    const dept = depts.find(d => d.id === deptId);
    if (trimmed === dept?.name) return;
    setEditSaving(true);
    const res = await fetch(`/api/departments/${deptId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    setEditSaving(false);
    if (res.ok) {
      setDepts(list => list.map(d => d.id === deptId ? { ...d, name: trimmed } : d));
    }
  }

  const filtered = depts.filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Header */}
      <div className="pb-5 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          {!loading && (
            <span className="text-sm font-semibold bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">{depts.length}</span>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#F0654D] hover:bg-[#E85B44] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          style={{ boxShadow: '0 2px 8px rgba(240,101,77,0.3)' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Department
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-xs">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search departments…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D]"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/[0.04] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-5 py-3">Department</th>
                <th className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Members</th>
                <th className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Tasks</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-5 py-3.5"><div className="h-3 w-40 bg-gray-200 animate-pulse rounded" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-3 w-8 bg-gray-100 animate-pulse rounded ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-3 w-8 bg-gray-100 animate-pulse rounded ml-auto" /></td>
                    <td className="px-4 py-3.5" />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
                    <svg className="mx-auto mb-3 text-gray-300" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                    <p className="text-sm text-gray-400">
                      {search ? 'No departments match your search' : 'No departments yet'}
                    </p>
                  </td>
                </tr>
              ) : filtered.map(dept => (
                <Fragment key={dept.id}>
                  {/* Department row */}
                  <tr
                    className={`border-b border-gray-100 transition-colors cursor-pointer ${expandedId === dept.id ? 'bg-[#F0654D]/[0.03]' : 'hover:bg-gray-50/50'}`}
                    onClick={() => handleToggle(dept.id)}
                  >
                    {/* Name cell — stops propagation for inline edit */}
                    <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                      {editingId === dept.id ? (
                        <input
                          autoFocus
                          value={editDraft}
                          onChange={e => setEditDraft(e.target.value)}
                          onBlur={() => handleRename(dept.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); handleRename(dept.id); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          disabled={editSaving}
                          className="text-sm font-semibold text-gray-800 border-b border-[#F0654D] focus:outline-none bg-transparent w-full max-w-xs"
                        />
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span
                            className="text-sm font-semibold text-gray-800"
                            onClick={() => handleToggle(dept.id)}
                          >
                            {dept.name}
                          </span>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setEditingId(dept.id); setEditDraft(dept.name); }}
                            title="Rename"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm tabular-nums text-gray-700">{dept.memberCount}</td>
                    <td className="px-4 py-3.5 text-right text-sm tabular-nums text-gray-700">{dept.taskCount}</td>
                    <td className="px-4 py-3.5 text-right">
                      <svg
                        className={`ml-auto text-gray-400 transition-transform duration-200 ${expandedId === dept.id ? 'rotate-180' : ''}`}
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                      >
                        <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </td>
                  </tr>

                  {/* Expanded member panel */}
                  {expandedId === dept.id && (
                    <tr>
                      <td colSpan={4} className="px-5 py-4 bg-gray-50/60 border-b border-gray-100">
                        {loadingMem && !membersMap[dept.id] ? (
                          <div className="flex items-center gap-2 py-1">
                            <div className="h-3 w-3 bg-gray-300 rounded-full animate-pulse" />
                            <div className="h-3 w-24 bg-gray-200 animate-pulse rounded" />
                          </div>
                        ) : (membersMap[dept.id] ?? []).length === 0 ? (
                          <p className="text-sm text-gray-400 py-1">No members in this department.</p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                              {(membersMap[dept.id] ?? []).length} member{(membersMap[dept.id] ?? []).length !== 1 ? 's' : ''}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                              {(membersMap[dept.id] ?? []).map(u => (
                                <div key={u.id} className="flex items-center gap-2.5 bg-white rounded-xl border border-gray-100 px-3 py-2.5">
                                  <div className="w-7 h-7 rounded-full bg-[#F0654D] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                    {initials(u.name)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-800 truncate">{u.name}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                                  </div>
                                  <RoleBadge role={u.role} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <NewDeptModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); setRefetch(n => n + 1); }}
        />
      )}
    </>
  );
}

// ── SUPER / USER view ─────────────────────────────────────────────────────────

function MemberView() {
  const { user } = useAuth();
  const [dept, setDept]       = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.departmentId) return;
    fetch(`/api/departments/${user.departmentId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setDept(d))
      .catch(() => {});
    fetch(`/api/users?departmentId=${user.departmentId}&pageSize=200`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { users: [] })
      .then(d => setMembers(d.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.departmentId]);

  if (!dept && loading) {
    return (
      <>
        <div className="pb-5 border-b border-gray-200">
          <div className="h-7 w-48 bg-gray-200 animate-pulse rounded mb-2" />
          <div className="h-4 w-64 bg-gray-100 animate-pulse rounded" />
        </div>
      </>
    );
  }

  if (!dept) return <p className="text-sm text-gray-400">Department not found.</p>;

  return (
    <>
      {/* Header */}
      <div className="pb-5 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">{dept.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Your department members and tasks at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <div className="bg-white rounded-2xl border border-black/[0.04] shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Members</p>
          <p className="text-3xl font-bold text-[#4C8DFF] tabular-nums">{members.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-black/[0.04] shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Tasks</p>
          <p className="text-3xl font-bold text-[#F4A23A] tabular-nums">{dept.taskCount}</p>
        </div>
      </div>

      {/* Members table */}
      <div className="bg-white rounded-2xl border border-black/[0.04] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Members</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-5 py-3">User</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Role</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
                        <div className="flex flex-col gap-1.5">
                          <div className="h-3 w-28 bg-gray-200 animate-pulse rounded" />
                          <div className="h-2.5 w-36 bg-gray-100 animate-pulse rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><div className="h-5 w-14 bg-gray-200 animate-pulse rounded-full" /></td>
                    <td className="px-4 py-3.5"><div className="h-5 w-14 bg-gray-200 animate-pulse rounded-full" /></td>
                  </tr>
                ))
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-sm text-gray-400">
                    No members in this department.
                  </td>
                </tr>
              ) : members.map(u => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
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
                  <td className="px-4 py-3.5"><StatusBadge active={u.isActive} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DepartmentsPage() {
  const { user } = useAuth();
  return (
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto animate-page-enter">
      {user?.role === 'ADMIN' ? <AdminView /> : <MemberView />}
    </main>
  );
}
