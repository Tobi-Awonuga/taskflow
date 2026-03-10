import { useEffect, useState } from 'react';

const FILTER_CLS =
  'appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 pr-8 text-sm text-gray-700 ' +
  'cursor-pointer focus:border-[#F0654D] focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30';

export default function AccessRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/users/access-requests?status=${status}`, {
      credentials: 'include',
      signal: ctrl.signal,
    })
      .then((res) => (res.ok ? res.json() : { requests: [] }))
      .then((data) => setRequests(data.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [status]);

  async function reviewRequest(userId, action) {
    setSavingId(userId);
    try {
      const res = await fetch(`/api/users/${userId}/access-request`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) return;
      setRequests((current) => current.filter((request) => request.id !== userId));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-w-0 animate-page-enter overflow-y-auto p-8">
      <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Access Requests</h1>
          <p className="mt-1 text-sm text-gray-400">
            Review Microsoft SSO users waiting for department approval.
          </p>
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={FILTER_CLS}
        >
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/[0.04] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">User</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">Requested Dept</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
                    Loading requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
                    No access requests found.
                  </td>
                </tr>
              ) : requests.map((request) => (
                <tr key={request.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-gray-800">{request.name}</p>
                    <p className="text-xs text-gray-400">{request.email}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {request.requestedDepartmentName || 'Not requested'}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {request.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {request.approvalStatus === 'PENDING' ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={savingId === request.id}
                          onClick={() => reviewRequest(request.id, 'REJECT')}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={savingId === request.id}
                          onClick={() => reviewRequest(request.id, 'APPROVE')}
                          className="rounded-lg bg-[#F0654D] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#E85B44] disabled:opacity-50"
                        >
                          Approve
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
