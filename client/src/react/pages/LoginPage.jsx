import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';

// ── Typewriter ──────────────────────────────────────────────────────────────────

function TypewriterText({ text, charDelay = 55 }) {
  const [displayed, setDisplayed] = useState('');
  const [cursorOpacity, setCursorOpacity] = useState(1);
  const [cursorAnim, setCursorAnim]       = useState('cursor-blink 0.75s step-end infinite');

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
          display:       'inline-block',
          width:         '1.5px',
          height:        '0.85em',
          background:    'currentColor',
          marginLeft:    '1px',
          verticalAlign: 'middle',
          borderRadius:  '1px',
          opacity:       cursorOpacity,
          transition:    cursorOpacity === 0 ? 'opacity 1s ease' : 'none',
          animation:     cursorAnim,
        }}
      />
    </span>
  );
}

// ── Shared field styles ─────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-gray-50/60 ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D] transition-colors';

const LABEL_CLS = 'block text-xs font-semibold text-gray-500 mb-1.5';

// ── LoginPage ───────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { setUser }         = useAuth();
  const navigate            = useNavigate();
  const [email, setEmail]   = useState('');
  const [password, setPass] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      setUser(data);
      navigate('/dashboard');
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthShell footer={`© ${new Date().getFullYear()} Nectar — Internal use only`}>

      {/* Wordmark */}
      <div className="mb-8 text-center">
        <span className="text-2xl font-bold text-[#F0654D] tracking-tight">Nectar</span>
        <p className="text-sm text-gray-400 mt-1 h-5">
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
            onChange={e => setEmail(e.target.value)}
            required autoFocus autoComplete="email"
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
              onChange={e => setPass(e.target.value)}
              required autoComplete="current-password"
              placeholder="••••••••"
              className={`${INPUT_CLS} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
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
          <div className="flex justify-end mt-1.5">
            <Link to="/forgot-password" className="text-xs text-[#F0654D] hover:underline">
              Forgot password?
            </Link>
          </div>
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
              Signing in…
            </>
          ) : 'Sign in'}
        </button>

      </form>
    </AuthShell>
  );
}
