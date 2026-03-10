import { useState, useEffect } from 'react';

const INPUT_CLS =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D] transition-colors';

const LABEL_CLS = 'text-xs font-semibold text-gray-500';

export default function SettingsPage() {
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(false), 3000);
    return () => clearTimeout(t);
  }, [success]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!current || !next || !confirm) { setError('All fields are required.'); return; }
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (next !== confirm) { setError('Passwords do not match.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }
      setCurrent(''); setNext(''); setConfirm('');
      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto max-w-2xl">

      {/* Header */}
      <div className="pb-5 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your account preferences and security.</p>
      </div>

      <div className="bg-white rounded-2xl border border-black/[0.04] shadow-sm p-8 flex flex-col gap-5">

        <div>
          <h2 className="text-lg font-bold text-gray-800">Security</h2>
          <p className="text-sm font-semibold text-gray-600 mt-1">Change Password</p>
        </div>

        <hr className="border-gray-100" />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLS}>Current Password</label>
            <input
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              className={INPUT_CLS}
              autoComplete="current-password"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLS}>New Password</label>
            <input
              type="password"
              value={next}
              onChange={e => setNext(e.target.value)}
              className={INPUT_CLS}
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-400">Minimum 8 characters</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLS}>Confirm New Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className={INPUT_CLS}
              autoComplete="new-password"
            />
          </div>

          {error   && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">Password updated successfully</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#F0654D] hover:bg-[#E85B44] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </form>

      </div>
    </main>
  );
}
