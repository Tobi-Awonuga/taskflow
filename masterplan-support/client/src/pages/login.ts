import { api } from '../api.js';
import { navigate } from '../router.js';

export function renderLogin(): void {
  document.getElementById('app')!.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo-icon">🍞</div>
          <div class="login-title">CT Bakery</div>
          <div class="login-sub">Masterplan Operations Support Layer</div>
        </div>
        <div id="login-alert"></div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="email" class="form-control" placeholder="you@ctbakery.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="password" class="form-control" placeholder="••••••••" required autocomplete="current-password" />
          </div>
          <button type="submit" id="login-btn" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:4px;">
            Sign In
          </button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form')!;
  const alertBox = document.getElementById('login-alert')!;
  const btn = document.getElementById('login-btn') as HTMLButtonElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.innerHTML = '';
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    const email = (document.getElementById('email') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;

    try {
      const { token, user } = await api.login(email, password);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      alertBox.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}
