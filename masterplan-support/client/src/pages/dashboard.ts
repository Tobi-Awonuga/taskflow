import { api } from '../api.js';
import { renderLayout, badge, formatDateTime } from '../components/layout.js';
import { navigate } from '../router.js';
import type { DashboardStats } from '../types.js';

export async function renderDashboard(): Promise<void> {
  renderLayout('<div class="spinner">Loading dashboard…</div>', '/dashboard');

  try {
    const stats: DashboardStats = await api.getDashboardStats();
    const { itemRequests, qaReceiving, finishedGoods, recentActivity } = stats;

    const content = `
      <div class="page-header">
        <div>
          <div class="page-title">Operations Dashboard</div>
          <div class="page-subtitle">CT Bakery — Masterplan Support Layer</div>
        </div>
      </div>

      <!-- Item Request Stats -->
      <div style="margin-bottom:8px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Item Creation Requests</div>
      <div class="stat-grid" style="margin-bottom:28px;">
        <div class="stat-card warning">
          <div class="stat-label">Pending Review</div>
          <div class="stat-value">${itemRequests.pending + itemRequests.underReview}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Approved</div>
          <div class="stat-value">${itemRequests.approved}</div>
        </div>
        <div class="stat-card primary">
          <div class="stat-label">Created in ERP</div>
          <div class="stat-value">${itemRequests.createdInErp}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">Rejected</div>
          <div class="stat-value">${itemRequests.rejected}</div>
        </div>
      </div>

      <!-- QA / FG Stats -->
      <div style="margin-bottom:8px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Quality & Safety</div>
      <div class="stat-grid" style="margin-bottom:28px;">
        <div class="stat-card primary">
          <div class="stat-label">QA Checks Today</div>
          <div class="stat-value">${qaReceiving.today}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">FG Pending QA</div>
          <div class="stat-value">${finishedGoods.pendingQa}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">FG On Hold</div>
          <div class="stat-value">${finishedGoods.onHold}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">FG Released</div>
          <div class="stat-value">${finishedGoods.released}</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card" style="margin-bottom:24px;">
        <div class="card-header">Quick Actions</div>
        <div class="card-body" style="display:flex;gap:12px;flex-wrap:wrap;">
          <button class="btn btn-primary" data-route="/item-requests">+ New Item Request</button>
          <button class="btn btn-ghost" data-route="/qa-checklists">+ QA Receiving Checklist</button>
          <button class="btn btn-ghost" data-route="/fg-releases">+ FG Release Record</button>
          <button class="btn btn-ghost" data-route="/sops">Browse SOPs</button>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="card">
        <div class="card-header">Recent Activity</div>
        ${
          recentActivity.length === 0
            ? '<div class="empty-state"><div class="empty-state-text">No recent activity.</div></div>'
            : `<div class="table-wrap" style="border:none;border-radius:0;">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recentActivity
                      .map(
                        (log) => `
                      <tr>
                        <td style="white-space:nowrap;font-size:12px;color:#6b7280;">${formatDateTime(log.createdAt)}</td>
                        <td style="white-space:nowrap;">${log.userName ?? '—'}</td>
                        <td>${badge(log.action)}</td>
                        <td>${log.description}</td>
                      </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    `;

    renderLayout(content, '/dashboard');

    // Bind quick action buttons
    document.querySelectorAll('[data-route]').forEach((el) => {
      el.addEventListener('click', () => navigate((el as HTMLElement).dataset['route']!));
    });
  } catch (err) {
    renderLayout(`<div class="alert alert-danger">Failed to load dashboard: ${err instanceof Error ? err.message : 'Unknown error'}</div>`, '/dashboard');
  }
}
