// TODO: Implement real API helpers for each resource (auth, tasks, users, departments)

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include', // send session cookie
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  health: () => request('/health'),
  // TODO: auth endpoints
  // TODO: task endpoints
  // TODO: user endpoints
  // TODO: department endpoints
};
