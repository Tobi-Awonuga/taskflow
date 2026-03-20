import { api } from '../api.js';
import { renderLayout, badge, formatDateTime } from '../components/layout.js';
import type { AuditLog } from '../types.js';

export async function renderAuditLog(): Promise<void> {
  renderLayout('<div class="spinner">Loading…</div>', '/audit-log');

  const logs: AuditLog[] = await api.listAuditLogs();

  const tableRows = logs
    .map(
      (l) => `
    <tr>
      <td style="white-space:nowrap;font-size:12px;color:#6b7280;">${formatDateTime(l.createdAt)}</td>
      <td>
        <div style="font-weight:500;">${l.userName ?? 'System'}</div>
        <div style="font-size:12px;color:#9ca3af;">${l.userDept ?? ''}</div>
      </td>
      <td>${badge(l.action)}</td>
      <td><span style="font-size:12px;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${l.entityType.replace(/_/g, ' ')}</span></td>
      <td>${l.description}</td>
    </tr>`
    )
    .join('');

  const content = `
    <div class="page-header">
      <div>
        <div class="page-title">Audit Log</div>
        <div class="page-subtitle">Full record of all actions in the support layer</div>
      </div>
    </div>

    <div class="filter-bar" style="margin-bottom:16px;">
      <select id="filter-entity" style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;">
        <option value="">All Entity Types</option>
        <option value="item_request">Item Request</option>
        <option value="qa_checklist">QA Checklist</option>
        <option value="fg_release">FG Release</option>
        <option value="sop">SOP</option>
        <option value="label">Label</option>
        <option value="user">User</option>
      </select>
      <select id="filter-action" style="padding:7px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;">
        <option value="">All Actions</option>
        <option value="created">Created</option>
        <option value="updated">Updated</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="released">Released</option>
        <option value="signed_off">Signed Off</option>
        <option value="deleted">Deleted</option>
      </select>
    </div>

    <div class="table-wrap" id="log-table">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>User</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">🗒️</div><div class="empty-state-title">No audit entries</div></div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  renderLayout(content, '/audit-log');

  async function applyFilters(): Promise<void> {
    const entityType = (document.getElementById('filter-entity') as HTMLSelectElement).value;
    const action = (document.getElementById('filter-action') as HTMLSelectElement).value;
    const params: Record<string, string> = {};
    if (entityType) params['entityType'] = entityType;
    if (action) params['action'] = action;

    const filtered = await api.listAuditLogs(params);
    const tbody = document.querySelector('#log-table tbody')!;
    tbody.innerHTML = filtered
      .map(
        (l) => `
      <tr>
        <td style="white-space:nowrap;font-size:12px;color:#6b7280;">${formatDateTime(l.createdAt)}</td>
        <td>
          <div style="font-weight:500;">${l.userName ?? 'System'}</div>
          <div style="font-size:12px;color:#9ca3af;">${l.userDept ?? ''}</div>
        </td>
        <td>${badge(l.action)}</td>
        <td><span style="font-size:12px;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${l.entityType.replace(/_/g, ' ')}</span></td>
        <td>${l.description}</td>
      </tr>`
      )
      .join('') || `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-text">No entries match filters.</div></div></td></tr>`;
  }

  document.getElementById('filter-entity')?.addEventListener('change', applyFilters);
  document.getElementById('filter-action')?.addEventListener('change', applyFilters);
}
