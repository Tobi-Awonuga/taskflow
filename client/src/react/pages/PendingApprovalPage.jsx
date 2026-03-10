import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function PendingApprovalPage() {
  const { user, refreshUser, setUser } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      fetch('/api/users/me/access-request', { credentials: 'include', signal: ctrl.signal }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/departments/options', { credentials: 'include', signal: ctrl.signal }).then((res) => (res.ok ? res.json() : { departments: [] })),
    ])
      .then(([requestData, departmentData]) => {
        if (requestData?.user) setUser(requestData.user);
        if (requestData?.requestedDepartment?.id) {
          setSelectedDepartmentId(String(requestData.requestedDepartment.id));
        }
        setDepartments(departmentData?.departments ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [setUser]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedDepartmentId) return;

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/users/me/access-request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedDepartmentId: Number(selectedDepartmentId) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Could not submit your request.');
        return;
      }

      if (data.user) {
        setUser(data.user);
      } else {
        await refreshUser();
      }
      setMessage('Department request submitted. An approver can review it now.');
    } catch {
      setMessage('Network error while submitting your request.');
    } finally {
      setSaving(false);
    }
  }

  const approvalStatus = user?.approvalStatus ?? 'PENDING';

  return (
    <>
      <div className="mb-8 text-center">
        <span className="text-2xl font-bold text-[#F0654D] tracking-tight">Nectar</span>
        <p className="mt-1 text-sm text-gray-400">Your Microsoft account is verified.</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-5 text-sm text-amber-900">
        <p className="font-semibold">
          {approvalStatus === 'REJECTED' ? 'Your last request was rejected.' : 'Your account is pending approval.'}
        </p>
        <p>
          Nectar created your profile, but an administrator or department super user still
          needs to approve access before you can use the app.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="request-department" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Requested Department
          </label>
          <select
            id="request-department"
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
            disabled={loading || saving}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-[#F0654D] focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30"
          >
            <option value="">Select a department...</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </div>

        {message && (
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || saving || !selectedDepartmentId}
          className="block w-full rounded-xl bg-[#F0654D] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#E85B44] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Submitting...' : 'Submit department request'}
        </button>
      </form>

      <div className="mt-4">
        <Link
          to="/login"
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back to sign in
        </Link>
      </div>
    </>
  );
}
