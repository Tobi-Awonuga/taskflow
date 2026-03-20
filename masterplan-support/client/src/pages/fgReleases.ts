import { api } from '../api.js';
import { renderLayout, badge, formatDateTime, getUser } from '../components/layout.js';

export async function renderFgReleases(): Promise<void> {
  renderLayout('<div class="spinner">Loading…</div>', '/fg-releases');

  const releases = await api.listFgReleases();
  const user = getUser()!;
  const canAct = ['admin', 'approver', 'qa'].includes(user.role);

  const tableRows = releases
    .map(
      (r) => `
    <tr>
      <td><code style="font-size:12px;">${r.releaseNumber}</code></td>
      <td>${r.productionOrderNum}</td>
      <td>
        <div style="font-weight:500;">${r.itemCode}</div>
        <div style="font-size:12px;color:#6b7280;">${r.itemDescription}</div>
      </td>
      <td>${r.lotNumber}</td>
      <td>${r.quantityProduced} ${r.uom}</td>
      <td>${badge(r.status)}</td>
      <td style="font-size:12px;color:#9ca3af;">${r.holdReason ? `<span style="color:#dc2626;">${r.holdReason}</span>` : '—'}</td>
      <td style="font-size:12px;color:#6b7280;">${r.qaUserName ?? '—'}</td>
      <td>
        ${canAct && r.status === 'pending_qa' ? `
          <button class="btn btn-success btn-sm release-btn" data-id="${r.id}">Release</button>
          <button class="btn btn-danger btn-sm hold-btn" data-id="${r.id}" style="margin-left:4px;">Hold</button>
        ` : '—'}
      </td>
    </tr>`
    )
    .join('');

  const content = `
    <div class="page-header">
      <div>
        <div class="page-title">Finished Goods Release Board</div>
        <div class="page-subtitle">QA hold & release status for all finished goods lots</div>
      </div>
      ${['admin', 'qa', 'production'].includes(user.role) ? '<button class="btn btn-primary" id="new-fg-btn">+ New FG Record</button>' : ''}
    </div>

    <div id="form-container"></div>
    <div id="hold-modal"></div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Release #</th>
            <th>Prod Order</th>
            <th>Item</th>
            <th>Lot #</th>
            <th>Qty</th>
            <th>Status</th>
            <th>Hold Reason</th>
            <th>QA User</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">No FG records yet</div></div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  renderLayout(content, '/fg-releases');

  // Release buttons
  document.querySelectorAll('.release-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = parseInt((btn as HTMLElement).dataset['id']!);
      if (!confirm('Release this lot for shipping?')) return;
      try {
        await api.releaseFg(id);
        renderFgReleases();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Error');
      }
    });
  });

  // Hold buttons
  document.querySelectorAll('.hold-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt((btn as HTMLElement).dataset['id']!);
      showHoldModal(id);
    });
  });

  document.getElementById('new-fg-btn')?.addEventListener('click', () => showNewFgForm());
}

function showHoldModal(id: number): void {
  const modal = document.getElementById('hold-modal')!;
  modal.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:999;">
      <div class="card" style="width:440px;max-width:95vw;">
        <div class="card-header">Place Lot On Hold</div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Hold Reason <span class="required">*</span></label>
            <textarea id="hold-reason-input" class="form-control" rows="3" placeholder="Describe why this lot is being placed on hold…"></textarea>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="cancel-hold" class="btn btn-ghost">Cancel</button>
            <button id="confirm-hold" class="btn btn-danger">Place On Hold</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('cancel-hold')?.addEventListener('click', () => { modal.innerHTML = ''; });
  document.getElementById('confirm-hold')?.addEventListener('click', async () => {
    const reason = (document.getElementById('hold-reason-input') as HTMLTextAreaElement).value.trim();
    if (!reason) { alert('Hold reason is required.'); return; }
    try {
      await api.holdFg(id, reason);
      modal.innerHTML = '';
      renderFgReleases();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  });
}

function showNewFgForm(): void {
  const container = document.getElementById('form-container')!;
  container.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <span>New FG Release Record</span>
        <button id="cancel-form" class="btn btn-ghost btn-sm">✕</button>
      </div>
      <div class="card-body">
        <div id="form-alert"></div>
        <form id="fg-form">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Production Order # <span class="required">*</span></label>
              <input type="text" id="productionOrderNum" class="form-control" placeholder="PRD-10087" required />
            </div>
            <div class="form-group">
              <label class="form-label">Item Code <span class="required">*</span></label>
              <input type="text" id="itemCode" class="form-control" placeholder="FG-MUFFIN-BLUEBERRY-4PK" required />
            </div>
            <div class="form-group">
              <label class="form-label">Item Description <span class="required">*</span></label>
              <input type="text" id="itemDescription" class="form-control" placeholder="Blueberry Muffin 4-Pack" required />
            </div>
            <div class="form-group">
              <label class="form-label">Lot Number <span class="required">*</span></label>
              <input type="text" id="lotNumber" class="form-control" placeholder="PRD-240320-001" required />
            </div>
            <div class="form-group">
              <label class="form-label">Quantity Produced <span class="required">*</span></label>
              <input type="number" id="quantityProduced" class="form-control" placeholder="1200" required />
            </div>
            <div class="form-group">
              <label class="form-label">UOM <span class="required">*</span></label>
              <input type="text" id="uom" class="form-control" placeholder="CS" required />
            </div>
            <div class="form-group">
              <label class="form-label">Production Date <span class="required">*</span></label>
              <input type="date" id="productionDate" class="form-control" required />
            </div>
          </div>
          <div style="display:flex;gap:12px;justify-content:flex-end;">
            <button type="button" id="cancel-form-2" class="btn btn-ghost">Cancel</button>
            <button type="submit" id="submit-btn" class="btn btn-primary">Create Record</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const cancel = () => { container.innerHTML = ''; };
  document.getElementById('cancel-form')?.addEventListener('click', cancel);
  document.getElementById('cancel-form-2')?.addEventListener('click', cancel);

  document.getElementById('fg-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Creating…';
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;

    try {
      await api.createFgRelease({
        productionOrderNum: val('productionOrderNum'),
        itemCode: val('itemCode'),
        itemDescription: val('itemDescription'),
        lotNumber: val('lotNumber'),
        quantityProduced: parseFloat(val('quantityProduced')),
        uom: val('uom'),
        productionDate: val('productionDate'),
      });
      renderFgReleases();
    } catch (err) {
      document.getElementById('form-alert')!.innerHTML =
        `<div class="alert alert-danger">${err instanceof Error ? err.message : 'Error'}</div>`;
      btn.disabled = false;
      btn.textContent = 'Create Record';
    }
  });
}
