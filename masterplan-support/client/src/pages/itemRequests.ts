import { api } from '../api.js';
import { renderLayout, badge, formatDate, getUser } from '../components/layout.js';
import { navigate } from '../router.js';

export async function renderItemRequests(): Promise<void> {
  renderLayout('<div class="spinner">Loading…</div>', '/item-requests');

  const requests = await api.listItemRequests();
  const user = getUser()!;
  const canApprove = ['admin', 'approver'].includes(user.role);

  const tableRows = requests
    .map(
      (r) => `
    <tr style="cursor:pointer;" data-id="${r.id}">
      <td><code style="font-size:12px;">${r.requestNumber}</code></td>
      <td>
        <div style="font-weight:500;">${r.proposedName}</div>
        <div style="font-size:12px;color:#6b7280;">${r.category} · ${r.uom}</div>
      </td>
      <td>${r.itemType.replace(/_/g, ' ')}</td>
      <td>${badge(r.urgency)}</td>
      <td>${badge(r.status)}</td>
      <td style="font-size:12px;color:#6b7280;">${r.requesterName ?? '—'}</td>
      <td style="font-size:12px;color:#6b7280;">${formatDate(r.createdAt)}</td>
    </tr>`
    )
    .join('');

  const content = `
    <div class="page-header">
      <div>
        <div class="page-title">Item Creation Requests</div>
        <div class="page-subtitle">All requests to add new items to Masterplan ERP</div>
      </div>
      <button class="btn btn-primary" id="new-request-btn">+ New Request</button>
    </div>

    <div id="form-container"></div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Request #</th>
            <th>Proposed Item</th>
            <th>Type</th>
            <th>Urgency</th>
            <th>Status</th>
            <th>Requester</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">No requests yet</div></div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  renderLayout(content, '/item-requests');

  // Row click → detail
  document.querySelectorAll('tbody tr[data-id]').forEach((row) => {
    row.addEventListener('click', () => navigate(`/item-requests/${(row as HTMLElement).dataset['id']}`));
  });

  // New request button → show form
  document.getElementById('new-request-btn')?.addEventListener('click', () => {
    renderNewRequestForm();
  });
}

function renderNewRequestForm(): void {
  const container = document.getElementById('form-container')!;
  container.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <span>New Item Creation Request</span>
        <button id="cancel-form" class="btn btn-ghost btn-sm">✕ Cancel</button>
      </div>
      <div class="card-body">
        <div id="form-alert"></div>
        <form id="item-request-form">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Proposed Item Code <span class="required">*</span></label>
              <input type="text" id="proposedCode" class="form-control" placeholder="RM-FLOUR-BREAD-50LB" required />
              <div class="form-hint">Format: [TYPE]-[CATEGORY]-[DESCRIPTION]</div>
            </div>
            <div class="form-group">
              <label class="form-label">Proposed Full Name <span class="required">*</span></label>
              <input type="text" id="proposedName" class="form-control" placeholder="Bread Flour, 50 lb bag, General Mills" required />
            </div>
            <div class="form-group">
              <label class="form-label">Item Type <span class="required">*</span></label>
              <select id="itemType" class="form-control" required>
                <option value="">Select type…</option>
                <option value="raw_material">Raw Material</option>
                <option value="packaging">Packaging</option>
                <option value="finished_good">Finished Good</option>
                <option value="consumable">Consumable / Indirect</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Category <span class="required">*</span></label>
              <input type="text" id="category" class="form-control" placeholder="Flour & Grains" required />
            </div>
            <div class="form-group">
              <label class="form-label">Unit of Measure (UOM) <span class="required">*</span></label>
              <select id="uom" class="form-control" required>
                <option value="">Select UOM…</option>
                <option value="EA">EA — Each</option>
                <option value="LB">LB — Pound</option>
                <option value="KG">KG — Kilogram</option>
                <option value="OZ">OZ — Ounce</option>
                <option value="GAL">GAL — Gallon</option>
                <option value="CS">CS — Case</option>
                <option value="BAG">BAG — Bag</option>
                <option value="PKG">PKG — Package</option>
                <option value="PT">PT — Pint</option>
                <option value="QT">QT — Quart</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Urgency</label>
              <select id="urgency" class="form-control">
                <option value="routine">Routine (2 business days)</option>
                <option value="urgent">Urgent (same day)</option>
                <option value="critical">Critical (ASAP)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Supplier</label>
              <input type="text" id="supplier" class="form-control" placeholder="General Mills" />
            </div>
            <div class="form-group">
              <label class="form-label">Supplier Part #</label>
              <input type="text" id="supplierCode" class="form-control" placeholder="GM-BF50" />
            </div>
            <div class="form-group">
              <label class="form-label">Est. Unit Cost</label>
              <input type="text" id="estimatedCost" class="form-control" placeholder="22.50" />
            </div>
            <div class="form-group">
              <label class="form-label">Storage Location</label>
              <input type="text" id="storageLocation" class="form-control" placeholder="Dry Storage, Cooler, Freezer…" />
            </div>
            <div class="form-group">
              <label class="form-label">Shelf Life</label>
              <input type="text" id="shelfLife" class="form-control" placeholder="12 months" />
            </div>
            <div class="form-group">
              <label class="form-label">Needed By Date</label>
              <input type="date" id="neededByDate" class="form-control" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Allergen Flags</label>
            <div style="display:flex;flex-wrap:wrap;gap:12px;">
              ${['wheat','dairy','eggs','soy','tree_nuts','peanuts','fish','shellfish','sesame'].map((a) =>
                `<label class="form-check">
                  <input type="checkbox" class="allergen-flag" value="${a}" />
                  ${a.replace(/_/g, ' ')}
                </label>`
              ).join('')}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Business Justification <span class="required">*</span></label>
            <textarea id="businessReason" class="form-control" rows="3"
              placeholder="Why is this new item needed? Have you searched for an existing item?" required></textarea>
          </div>

          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;">
            <button type="button" id="cancel-form-2" class="btn btn-ghost">Cancel</button>
            <button type="submit" id="submit-btn" class="btn btn-primary">Submit Request</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('cancel-form')?.addEventListener('click', () => { container.innerHTML = ''; });
  document.getElementById('cancel-form-2')?.addEventListener('click', () => { container.innerHTML = ''; });

  document.getElementById('item-request-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    const allergenFlags = Array.from(document.querySelectorAll('.allergen-flag:checked')).map(
      (el) => (el as HTMLInputElement).value
    );

    const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;

    try {
      await api.createItemRequest({
        proposedCode: val('proposedCode'),
        proposedName: val('proposedName'),
        itemType: val('itemType'),
        category: val('category'),
        uom: val('uom'),
        urgency: val('urgency'),
        supplier: val('supplier') || undefined,
        supplierCode: val('supplierCode') || undefined,
        estimatedCost: val('estimatedCost') || undefined,
        storageLocation: val('storageLocation') || undefined,
        shelfLife: val('shelfLife') || undefined,
        neededByDate: val('neededByDate') || undefined,
        allergenFlags,
        businessReason: val('businessReason'),
      });

      navigate('/item-requests');
    } catch (err) {
      document.getElementById('form-alert')!.innerHTML =
        `<div class="alert alert-danger">${err instanceof Error ? err.message : 'Submit failed'}</div>`;
      btn.disabled = false;
      btn.textContent = 'Submit Request';
    }
  });
}
