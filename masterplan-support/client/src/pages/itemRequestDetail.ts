import { api } from '../api.js';
import { renderLayout, badge, formatDateTime, getUser } from '../components/layout.js';
import { navigate } from '../router.js';
import type { ItemRequest } from '../types.js';

export async function renderItemRequestDetail(id: number): Promise<void> {
  renderLayout('<div class="spinner">Loading…</div>', '/item-requests');

  const request: ItemRequest = await api.getItemRequest(id);
  const user = getUser()!;
  const canApprove = ['admin', 'approver'].includes(user.role);
  const canEnterCode = user.id === request.requesterId || user.role === 'admin';

  const allergens: string[] = JSON.parse(request.allergenFlags || '[]');

  const approvalHistory = (request.approvals ?? [])
    .map(
      (a) => `
    <tr>
      <td>${formatDateTime(a.createdAt)}</td>
      <td>${a.approverName ?? '—'}</td>
      <td>${badge(a.decision)}</td>
      <td>${a.comments ?? '—'}</td>
    </tr>`
    )
    .join('');

  const approvedTemplate = request.approvedTemplate
    ? JSON.parse(request.approvedTemplate)
    : null;

  const content = `
    <div class="page-header">
      <div>
        <button class="btn btn-ghost btn-sm" id="back-btn">← Back to Requests</button>
        <div class="page-title" style="margin-top:8px;">${request.requestNumber}</div>
        <div class="page-subtitle">${request.proposedName}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        ${badge(request.status)}
        ${badge(request.urgency)}
      </div>
    </div>

    <div id="action-alert"></div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;">
      <!-- Left column -->
      <div>
        <!-- Item details -->
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header">Item Details</div>
          <div class="card-body">
            <div class="form-grid">
              <div class="detail-field"><div class="detail-label">Proposed Code</div><div class="detail-value"><code>${request.proposedCode}</code></div></div>
              <div class="detail-field"><div class="detail-label">Item Type</div><div class="detail-value">${request.itemType.replace(/_/g, ' ')}</div></div>
              <div class="detail-field"><div class="detail-label">Category</div><div class="detail-value">${request.category}</div></div>
              <div class="detail-field"><div class="detail-label">Unit of Measure</div><div class="detail-value">${request.uom}</div></div>
              <div class="detail-field"><div class="detail-label">Supplier</div><div class="detail-value">${request.supplier ?? '—'}</div></div>
              <div class="detail-field"><div class="detail-label">Supplier Code</div><div class="detail-value">${request.supplierCode ?? '—'}</div></div>
              <div class="detail-field"><div class="detail-label">Est. Cost</div><div class="detail-value">${request.estimatedCost ? '$' + request.estimatedCost : '—'}</div></div>
              <div class="detail-field"><div class="detail-label">Storage Location</div><div class="detail-value">${request.storageLocation ?? '—'}</div></div>
              <div class="detail-field"><div class="detail-label">Shelf Life</div><div class="detail-value">${request.shelfLife ?? '—'}</div></div>
              <div class="detail-field">
                <div class="detail-label">Allergen Flags</div>
                <div class="detail-value">
                  ${allergens.length === 0 ? '<span style="color:#6b7280;">None declared</span>' : allergens.map((a) => `<span class="badge badge-pending" style="margin-right:4px;">${a.replace(/_/g, ' ')}</span>`).join('')}
                </div>
              </div>
            </div>
            <div class="detail-field" style="margin-top:8px;">
              <div class="detail-label">Business Justification</div>
              <div class="detail-value" style="line-height:1.6;">${request.businessReason}</div>
            </div>
          </div>
        </div>

        <!-- Approved template (if approved) -->
        ${approvedTemplate ? `
        <div class="card" style="margin-bottom:20px;border-color:#6ee7b7;">
          <div class="card-header" style="background:#d1fae5;color:#065f46;">✅ Approved — Enter in Masterplan Using This Template</div>
          <div class="card-body">
            <div class="alert alert-info" style="margin-bottom:16px;">
              Create this item in Masterplan exactly as shown below. Once created, enter the Masterplan item code below.
            </div>
            <div class="form-grid">
              <div class="detail-field"><div class="detail-label">Name to Enter</div><div class="detail-value"><strong>${approvedTemplate.masterplanName}</strong></div></div>
              <div class="detail-field"><div class="detail-label">UOM</div><div class="detail-value">${approvedTemplate.uom}</div></div>
              <div class="detail-field"><div class="detail-label">Category</div><div class="detail-value">${approvedTemplate.category}</div></div>
              <div class="detail-field"><div class="detail-label">Allergens</div><div class="detail-value">${(approvedTemplate.allergenFlags as string[]).join(', ') || 'None'}</div></div>
            </div>
            <div style="margin-top:12px;">
              <div class="detail-label" style="margin-bottom:4px;">Instructions:</div>
              <ol style="margin-left:16px;line-height:1.9;">
                ${(approvedTemplate.instructions as string[]).map((i: string) => `<li>${i}</li>`).join('')}
              </ol>
            </div>
            ${canEnterCode && request.status === 'approved' ? `
            <div style="margin-top:16px;display:flex;gap:10px;align-items:flex-end;">
              <div class="form-group" style="flex:1;margin-bottom:0;">
                <label class="form-label">Masterplan Item Code (after creating)</label>
                <input type="text" id="masterplan-code" class="form-control" placeholder="e.g. 10042" value="${request.masterplanCode ?? ''}" />
              </div>
              <button class="btn btn-success" id="save-code-btn">Save Code</button>
            </div>` : ''}
            ${request.masterplanCode ? `<div class="alert alert-success" style="margin-top:12px;">Masterplan code: <strong>${request.masterplanCode}</strong></div>` : ''}
          </div>
        </div>` : ''}

        <!-- Approval history -->
        <div class="card">
          <div class="card-header">Approval History</div>
          ${approvalHistory
            ? `<div class="table-wrap" style="border:none;border-radius:0;">
                <table>
                  <thead><tr><th>Date</th><th>Approver</th><th>Decision</th><th>Comments</th></tr></thead>
                  <tbody>${approvalHistory}</tbody>
                </table>
              </div>`
            : '<div class="empty-state" style="padding:24px;"><div class="empty-state-text">No approvals yet.</div></div>'}
        </div>
      </div>

      <!-- Right column: actions -->
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header">Request Info</div>
          <div class="card-body">
            <div class="detail-field"><div class="detail-label">Requested By</div><div class="detail-value">${request.requesterName ?? '—'}</div></div>
            <div class="detail-field"><div class="detail-label">Department</div><div class="detail-value">${request.requesterDept ?? '—'}</div></div>
            <div class="detail-field"><div class="detail-label">Submitted</div><div class="detail-value">${formatDateTime(request.createdAt)}</div></div>
            <div class="detail-field"><div class="detail-label">Needed By</div><div class="detail-value">${request.neededByDate ? formatDateTime(request.neededByDate) : '—'}</div></div>
          </div>
        </div>

        ${canApprove && ['pending', 'under_review'].includes(request.status) ? `
        <div class="card">
          <div class="card-header">Approver Actions</div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Comments</label>
              <textarea id="approval-comments" class="form-control" rows="3" placeholder="Optional comments…"></textarea>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button class="btn btn-success" id="approve-btn">✓ Approve Request</button>
              <button class="btn btn-danger" id="reject-btn">✗ Reject Request</button>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>
  `;

  renderLayout(content, '/item-requests');

  document.getElementById('back-btn')?.addEventListener('click', () => navigate('/item-requests'));

  const alertBox = document.getElementById('action-alert')!;

  document.getElementById('approve-btn')?.addEventListener('click', async () => {
    const comments = (document.getElementById('approval-comments') as HTMLTextAreaElement).value;
    try {
      await api.approveItemRequest(id, comments);
      renderItemRequestDetail(id);
    } catch (err) {
      alertBox.innerHTML = `<div class="alert alert-danger">${err instanceof Error ? err.message : 'Error'}</div>`;
    }
  });

  document.getElementById('reject-btn')?.addEventListener('click', async () => {
    const comments = (document.getElementById('approval-comments') as HTMLTextAreaElement).value;
    if (!comments.trim()) {
      alertBox.innerHTML = '<div class="alert alert-warning">Please enter a rejection reason.</div>';
      return;
    }
    try {
      await api.rejectItemRequest(id, comments);
      renderItemRequestDetail(id);
    } catch (err) {
      alertBox.innerHTML = `<div class="alert alert-danger">${err instanceof Error ? err.message : 'Error'}</div>`;
    }
  });

  document.getElementById('save-code-btn')?.addEventListener('click', async () => {
    const code = (document.getElementById('masterplan-code') as HTMLInputElement).value.trim();
    if (!code) {
      alertBox.innerHTML = '<div class="alert alert-warning">Please enter the Masterplan code.</div>';
      return;
    }
    try {
      await api.setErpCode(id, code);
      renderItemRequestDetail(id);
    } catch (err) {
      alertBox.innerHTML = `<div class="alert alert-danger">${err instanceof Error ? err.message : 'Error'}</div>`;
    }
  });
}
