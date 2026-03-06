import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';

const INPUT_CLS =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-gray-50/60 ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D] transition-colors';

const LABEL_CLS = 'block text-xs font-semibold text-gray-500 mb-1.5';

export default function ForgotPasswordPage() {
  const [email,  setEmail]  = useState('');
  const [error,  setError]  = useState('');
  const [sent,   setSent]   = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
      setSent(true);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthShell>

      {/* Wordmark */}
      <div className="mb-8 text-center">
        <span className="text-2xl font-bold text-[#F0654D] tracking-tight">Nectar</span>
        <p className="text-sm text-gray-400 mt-1">Reset your password</p>
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#43B96D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Check your email</p>
            <p className="text-sm text-gray-400 mt-1">
              If <span className="font-medium text-gray-600">{email}</span> is registered, you'll receive a reset link shortly.
            </p>
          </div>
          <Link to="/login" className="text-sm text-[#F0654D] hover:underline mt-2">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} aria-label="Forgot password form" className="flex flex-col gap-5">

          <p className="text-sm text-gray-500">
            Enter your account email and we'll send you a password reset link.
          </p>

          <div>
            <label htmlFor="forgot-email" className={LABEL_CLS}>Email</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required autoFocus autoComplete="email"
              placeholder="you@example.com"
              className={INPUT_CLS}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-[#F0654D] hover:bg-[#E85B44] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            style={{ boxShadow: '0 4px 16px rgba(240,101,77,0.4)' }}
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Sending…
              </>
            ) : 'Send reset link'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Remember your password?{' '}
            <Link to="/login" className="text-[#F0654D] hover:underline">Sign in</Link>
          </p>

        </form>
      )}

    </AuthShell>
  );
}
