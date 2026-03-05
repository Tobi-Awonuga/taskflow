import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { setUser }        = useAuth();
  const navigate           = useNavigate();
  const [email, setEmail]  = useState('');
  const [password, setPass] = useState('');
  const [error, setError]  = useState('');
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
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      setUser(data);
      navigate('/tasks');
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 24 }}>TaskFlow</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPass(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        {error && (
          <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          style={{ width: '100%', padding: '10px', cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
