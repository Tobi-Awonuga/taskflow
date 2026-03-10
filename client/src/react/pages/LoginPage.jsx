import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function TypewriterText({ text, charDelay = 55 }) {
  const [displayed, setDisplayed] = useState('');
  const [cursorOpacity, setCursorOpacity] = useState(1);
  const [cursorAnim, setCursorAnim] = useState('cursor-blink 0.75s step-end infinite');

  useEffect(() => {
    let i = 0;
    setDisplayed('');
    setCursorOpacity(1);
    setCursorAnim('cursor-blink 0.75s step-end infinite');

    const tick = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(tick);
        setTimeout(() => {
          setCursorAnim('none');
          setCursorOpacity(0);
        }, 1400);
      }
    }, charDelay);

    return () => clearInterval(tick);
  }, [text, charDelay]);

  return (
    <span>
      {displayed}
      <span
        style={{
          display: 'inline-block',
          width: '1.5px',
          height: '0.85em',
          background: 'currentColor',
          marginLeft: '1px',
          verticalAlign: 'middle',
          borderRadius: '1px',
          opacity: cursorOpacity,
          transition: cursorOpacity === 0 ? 'opacity 1s ease' : 'none',
          animation: cursorAnim,
        }}
      />
    </span>
  );
}

const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5 text-sm text-gray-800 ' +
  'transition-colors focus:border-[#F0654D] focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30';

const LABEL_CLS = 'mb-1.5 block text-xs font-semibold text-gray-500';

const SSO_ERROR_MESSAGES = {
  sso_invalid_state: 'Microsoft sign-in could not be verified. Please try again.',
  sso_claims_missing: 'Microsoft did not return all required account details.',
  sso_not_configured: 'Microsoft sign-in is not configured yet.',
  sso_user_create_failed: 'We could not finish creating your Nectar account.',
  sso_user_not_provisioned: 'Your Nectar access is not ready yet.',
  sso_user_inactive: 'Your Nectar account is inactive.',
};

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ssoError = searchParams.get('error');
    setError(ssoError ? (SSO_ERROR_MESSAGES[ssoError] || 'Microsoft sign-in failed') : '');
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      setUser(data);
      navigate('/dashboard');
    } catch {
      setError('Network error, please try again');
    } finally {
      setSaving(false);
    }
  }

  function handleMicrosoftSignIn() {
    window.location.href = '/api/auth/microsoft/start';
  }

  return (
    <>
      <div className="mb-8 text-center">
        <span className="text-2xl font-bold tracking-tight text-[#F0654D]">Nectar</span>
        <p className="mt-1 h-5 text-sm text-gray-400">
          <TypewriterText text="welcome to the hive :)" />
        </p>
      </div>

      <form onSubmit={handleSubmit} aria-label="Sign in form" className="flex flex-col gap-5">
        <div>
          <label htmlFor="login-email" className={LABEL_CLS}>Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            placeholder="you@example.com"
            className={INPUT_CLS}
          />
        </div>

        <div>
          <label htmlFor="login-password" className={LABEL_CLS}>Password</label>
          <div className="relative">
            <input
              id="login-password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPass(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="........"
              className={`${INPUT_CLS} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPw((value) => !value)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
            >
              {showPw ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <div className="mt-1.5 flex justify-end">
            <Link to="/forgot-password" className="text-xs text-[#F0654D] hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-500">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-[#F0654D] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E85B44] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ boxShadow: '0 4px 16px rgba(240,101,77,0.4)' }}
        >
          {saving ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-gray-300">
          <span className="h-px flex-1 bg-gray-200" />
          <span>or</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={handleMicrosoftSignIn}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="2" width="9" height="9" fill="#F25022" />
            <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
            <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
            <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
          </svg>
          Continue with Microsoft
        </button>
      </form>
    </>
  );
}
