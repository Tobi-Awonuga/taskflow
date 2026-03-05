import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

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

function StatCard({ label, count, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{count}</p>
    </div>
  );
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
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
          <h3 className="text-base font-bold text-gray-800">New Department</h3>
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
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg">
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
  const [expandedId, setExpandedId] = useState(null);
  const [members, setMembers]       = useState([]);
  const [showModal, setShowModal]   = useState(false);
  const [refetch, setRefetch]       = useState(0);

  useEffect(() => {
    fetch('/api/departments', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { departments: [] })
      .then(d => setDepts(d.departments ?? []));
  }, [refetch]);

  useEffect(() => {
    if (!expandedId) { setMembers([]); return; }
    fetch(`/api/users?departmentId=${expandedId}&pageSize=100`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { users: [] })
      .then(d => setMembers(d.users ?? []));
  }, [expandedId]);

  function handleCardClick(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Departments</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#F0654D] hover:bg-[#E85B44] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Department
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {depts.map(dept => (
          <div
            key={dept.id}
            onClick={() => handleCardClick(dept.id)}
            className={`bg-white rounded-2xl border border-black/5 shadow-sm p-5 hover:shadow-md cursor-pointer transition-shadow ${expandedId === dept.id ? 'ring-2 ring-[#F0654D]/30' : ''}`}
          >
            <p className="text-base font-bold text-gray-800">{dept.name}</p>
            <p className="text-xs text-gray-400 mt-2">{dept.memberCount} members · {dept.taskCount} tasks</p>
          </div>
        ))}
      </div>

      {expandedId && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">
              {depts.find(d => d.id === expandedId)?.name} — Members
            </h3>
          </div>
          {members.length === 0
            ? <p className="px-5 py-8 text-sm text-gray-400 text-center">No members.</p>
            : (
              <div className="divide-y divide-gray-50">
                {members.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-[#F0654D] flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                    <RoleBadge role={u.role} />
                    <StatusBadge active={u.isActive} />
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

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
  const [dept, setDept]     = useState(null);
  const [allUsers, setAll]  = useState([]);

  useEffect(() => {
    if (!user?.departmentId) return;
    fetch(`/api/departments/${user.departmentId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setDept(d));
    fetch('/api/users', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { users: [] })
      .then(d => setAll(d.users ?? []));
  }, [user?.departmentId]);

  if (!dept) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-800">{dept.name}</h1>

      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <StatCard label="Members" count={allUsers.length} color="#4C8DFF" />
        <StatCard label="Tasks"   count={dept.taskCount}  color="#F4A23A" />
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3.5">User</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Role</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u, idx) => (
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
                <td className="px-4 py-3.5"><StatusBadge active={u.isActive} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DepartmentsPage() {
  const { user } = useAuth();

  return (
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto">
      {user?.role === 'ADMIN' ? <AdminView /> : <MemberView />}
    </main>
  );
}
