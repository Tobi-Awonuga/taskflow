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

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function EditableName({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const [saving, setSaving]   = useState(false);
  const [failed, setFailed]   = useState(false);

  async function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) { setEditing(false); setDraft(value); return; }
    setSaving(true);
    const ok = await onSave(trimmed);
    setSaving(false);
    if (!ok) { setFailed(true); setDraft(value); setTimeout(() => setFailed(false), 2000); }
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
        className="text-xl font-bold text-gray-800 text-center border-b border-[#F0654D] focus:outline-none bg-transparent pb-0.5 w-full"
      />
    );
  }

  return (
    <h2
      onClick={() => { setEditing(true); setDraft(value); }}
      title="Click to edit"
      className={`text-xl font-bold cursor-text select-none ${failed ? 'text-red-400' : 'text-gray-800'} ${saving ? 'opacity-50' : ''}`}
    >
      {saving ? 'Saving…' : value}
    </h2>
  );
}

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [deptName, setDeptName] = useState(null);

  useEffect(() => {
    if (!user?.departmentId) return;
    fetch(`/api/departments/${user.departmentId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setDeptName(d.name))
      .catch(() => {});
  }, [user?.departmentId]);

  if (!user) return null;

  async function handleNameSave(name) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUser({ ...user, name: updated.name });
      return true;
    }
    return false;
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-8 flex flex-col items-center gap-5 max-w-lg">

        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-[#F0654D] flex items-center justify-center text-white text-2xl font-bold select-none">
          {initials(user.name)}
        </div>

        {/* Editable name */}
        <EditableName value={user.name} onSave={handleNameSave} />

        {/* Fields */}
        <div className="w-full flex flex-col gap-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</span>
            <span className="text-sm text-gray-500">{user.email}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</span>
            <RoleBadge role={user.role} />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Department</span>
            <span className="text-sm text-gray-700">
              {user.departmentId ? (deptName ?? 'Loading…') : 'No department'}
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Member since</span>
            <span className="text-sm text-gray-500">{memberSince}</span>
          </div>
        </div>

      </div>
    </main>
  );
}
