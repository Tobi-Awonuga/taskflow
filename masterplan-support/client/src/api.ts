const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.hash = '#/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    post<{ token: string; user: import('./types').User }>('/auth/login', { email, password }),
  me: () => get<import('./types').User>('/auth/me'),

  // Item requests
  listItemRequests: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<import('./types').ItemRequest[]>(`/item-requests${qs}`);
  },
  getItemRequest: (id: number) => get<import('./types').ItemRequest>(`/item-requests/${id}`),
  createItemRequest: (body: unknown) => post<import('./types').ItemRequest>('/item-requests', body),
  approveItemRequest: (id: number, comments?: string) =>
    post<import('./types').ItemRequest>(`/item-requests/${id}/approve`, { comments }),
  rejectItemRequest: (id: number, comments: string) =>
    post<import('./types').ItemRequest>(`/item-requests/${id}/reject`, { comments }),
  setErpCode: (id: number, masterplanCode: string) =>
    patch<import('./types').ItemRequest>(`/item-requests/${id}/erp-code`, { masterplanCode }),

  // QA checklists
  listQaChecklists: () => get<import('./types').QaChecklist[]>('/qa-checklists'),
  getQaChecklist: (id: number) => get<import('./types').QaChecklist>(`/qa-checklists/${id}`),
  createQaChecklist: (body: unknown) => post<import('./types').QaChecklist>('/qa-checklists', body),

  // FG releases
  listFgReleases: () => get<import('./types').FgRelease[]>('/fg-releases'),
  getFgRelease: (id: number) => get<import('./types').FgRelease>(`/fg-releases/${id}`),
  createFgRelease: (body: unknown) => post<import('./types').FgRelease>('/fg-releases', body),
  releaseFg: (id: number, comments?: string) =>
    post<import('./types').FgRelease>(`/fg-releases/${id}/release`, { comments }),
  holdFg: (id: number, holdReason: string) =>
    post<import('./types').FgRelease>(`/fg-releases/${id}/hold`, { holdReason }),
  updateFgResults: (id: number, body: unknown) =>
    patch<import('./types').FgRelease>(`/fg-releases/${id}/results`, body),

  // SOPs
  listSops: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<import('./types').SopDocument[]>(`/sops${qs}`);
  },
  getSop: (id: number) => get<import('./types').SopDocument>(`/sops/${id}`),
  acknowledgeSop: (id: number) => post<{ acknowledged: boolean }>(`/sops/${id}/acknowledge`, {}),

  // Dashboard
  getDashboardStats: () => get<import('./types').DashboardStats>('/dashboard/stats'),
  getFgHolds: () => get<import('./types').FgRelease[]>('/dashboard/fg-holds'),
  getPendingItemRequests: () => get<import('./types').ItemRequest[]>('/dashboard/pending-item-requests'),

  // Audit logs
  listAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<import('./types').AuditLog[]>(`/audit-logs${qs}`);
  },
};
