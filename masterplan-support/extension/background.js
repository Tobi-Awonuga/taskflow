/**
 * CT Bakery — Item Creation Guard
 * Service Worker (background.js)
 *
 * Routes API calls from content.js to the CT Bakery support layer backend.
 * The content script cannot fetch cross-origin directly, so it uses
 * chrome.runtime.sendMessage() → this service worker → fetch() to backend.
 */

const DEFAULT_BACKEND = 'http://localhost:3001';

// ── Config helpers ────────────────────────────────────────────────────────
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['backendUrl', 'authToken'], (result) => {
      resolve({
        backendUrl: result.backendUrl || DEFAULT_BACKEND,
        authToken:  result.authToken  || null,
      });
    });
  });
}

// ── Message handler ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message || 'Unknown error from background' }));
  return true; // Keep channel open for async response
});

async function handleMessage(message) {
  const { backendUrl, authToken } = await getConfig();
  const base = backendUrl.replace(/\/$/, '');

  // ── VALIDATE_REQUEST ────────────────────────────────────────────────────
  // Public endpoint — no auth required. Returns approved request details.
  if (message.type === 'VALIDATE_REQUEST') {
    const url = `${base}/api/item-requests/validate/${encodeURIComponent(message.requestNumber)}`;
    const res  = await fetch(url, {
      method:  'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(body.error || `Validation failed (HTTP ${res.status})`);
    }

    return body; // { request: { id, requestNumber, proposedCode, proposedName, ... } }
  }

  // ── COMPLETE_REQUEST ────────────────────────────────────────────────────
  // Requires auth token. Records the final Masterplan item code.
  if (message.type === 'COMPLETE_REQUEST') {
    if (!authToken) {
      throw new Error('Not logged in. Open the extension popup to sign in to the CT Bakery portal.');
    }

    const url = `${base}/api/item-requests/${message.requestId}/erp-code`;
    const res  = await fetch(url, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        masterplanCode: message.masterplanCode,
        creationPath:   message.creationPath, // 'new' | 'copy'
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(body.error || `Could not record item code (HTTP ${res.status})`);
    }

    return body;
  }

  // ── LOG_BYPASS ──────────────────────────────────────────────────────────
  // Semi-public — sends auth token if available, but succeeds either way.
  if (message.type === 'LOG_BYPASS') {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    await fetch(`${base}/api/audit-logs/bypass`, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        url:       message.url,
        mode:      message.mode,
        timestamp: message.timestamp,
      }),
    }).catch(() => {}); // Silent — bypass log failure must never block the user

    return { ok: true };
  }

  throw new Error(`Unknown message type: ${message.type}`);
}
