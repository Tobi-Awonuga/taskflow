/**
 * CT Bakery — Item Creation Guard
 * Popup script
 *
 * Handles:
 *  - Login to the CT Bakery support layer (stores JWT in chrome.storage.local)
 *  - Backend URL configuration
 *  - Connection status check
 */

const DEFAULT_BACKEND = 'http://localhost:3001';

const $ = (id) => document.getElementById(id);

// ── Load saved config on open ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const { backendUrl, authToken, userName, userRole } = await storageGet(
    ['backendUrl', 'authToken', 'userName', 'userRole']
  );

  // Populate backend URL field
  $('backend-url').value = backendUrl || DEFAULT_BACKEND;

  // Check connection
  await checkConnection(backendUrl || DEFAULT_BACKEND);

  // Show logged-in or login view
  if (authToken) {
    showLoggedIn(userName, userRole);
  }
});

// ── Connection check ──────────────────────────────────────────────────────
async function checkConnection(backendUrl) {
  const dot  = $('status-dot');
  const text = $('status-text');
  const base = (backendUrl || DEFAULT_BACKEND).replace(/\/$/, '');

  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      dot.className  = 'connected';
      text.textContent = 'Connected to CT Bakery portal';
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    dot.className  = 'disconnected';
    text.textContent = 'Cannot reach portal — check URL below';
  }
}

// ── Login ─────────────────────────────────────────────────────────────────
$('login-btn').addEventListener('click', async () => {
  const email    = $('email-input').value.trim();
  const password = $('password-input').value;
  const msgEl    = $('msg');

  if (!email || !password) {
    showMsg('error', 'Email and password are required.');
    return;
  }

  $('login-btn').disabled = true;
  showMsg('info', 'Signing in…');

  const { backendUrl } = await storageGet(['backendUrl']);
  const base = (backendUrl || DEFAULT_BACKEND).replace(/\/$/, '');

  try {
    const res  = await fetch(`${base}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      showMsg('error', body.error || `Login failed (${res.status})`);
      $('login-btn').disabled = false;
      return;
    }

    // Store token and user info
    await storageSet({
      authToken: body.token,
      userName:  body.user?.name  || email,
      userRole:  body.user?.role  || 'user',
    });

    showMsg('success', 'Signed in!');
    $('password-input').value = '';
    showLoggedIn(body.user?.name || email, body.user?.role || '');
  } catch (err) {
    showMsg('error', 'Network error — check backend URL.');
    $('login-btn').disabled = false;
  }
});

// ── Logout ────────────────────────────────────────────────────────────────
$('logout-btn').addEventListener('click', async () => {
  await storageSet({ authToken: null, userName: null, userRole: null });
  $('logged-in-view').hidden = true;
  $('login-view').hidden     = false;
  $('login-btn').disabled    = false;
  showMsg('', '');
});

// ── Save backend URL ──────────────────────────────────────────────────────
$('save-url-btn').addEventListener('click', async () => {
  const url = $('backend-url').value.trim();
  if (!url) return;
  await storageSet({ backendUrl: url });
  await checkConnection(url);
});

// ── Helpers ───────────────────────────────────────────────────────────────
function showLoggedIn(name, role) {
  $('logged-in-view').hidden = false;
  $('login-view').hidden     = true;
  $('user-name').textContent = name || '—';
  $('user-role').textContent = role ? `Role: ${role}` : '';
}

function showMsg(type, text) {
  const el = $('msg');
  el.textContent = text;
  el.className   = type;
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}
