import { api } from '../api.js';
import { renderLayout, badge, formatDate } from '../components/layout.js';

export async function renderQaChecklists(): Promise<void> {
  renderLayout('<div class="spinner">Loading…</div>', '/qa-checklists');

  const checklists = await api.listQaChecklists();

  const tableRows = checklists
    .map(
      (c) => `
    <tr>
      <td><code style="font-size:12px;">${c.checklistNumber}</code></td>
      <td>${c.poNumber}</td>
      <td>${c.supplierName}</td>
      <td>
        <div style="font-weight:500;">${c.itemCode}</div>
        <div style="font-size:12px;color:#6b7280;">${c.itemDescription}</div>
      </td>
      <td>${c.lotNumber ?? '—'}</td>
      <td>${badge(c.disposition)}</td>
      <td style="font-size:12px;color:#6b7280;">${c.qaUserName ?? '—'}</td>
      <td style="font-size:12px;color:#6b7280;">${formatDate(c.createdAt)}</td>
    </tr>`
    )
    .join('');

  const content = `
    <div class="page-header">
      <div>
        <div class="page-title">QA Receiving Checklists</div>
        <div class="page-subtitle">All receiving inspections with QA sign-off</div>
      </div>
      <button class="btn btn-primary" id="new-checklist-btn">+ New Checklist</button>
    </div>

    <div id="form-container"></div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Checklist #</th>
            <th>PO #</th>
            <th>Supplier</th>
            <th>Item</th>
            <th>Lot #</th>
            <th>Disposition</th>
            <th>QA User</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No checklists yet</div></div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  renderLayout(content, '/qa-checklists');

  document.getElementById('new-checklist-btn')?.addEventListener('click', () => {
    showQaForm();
  });
}

function showQaForm(): void {
  const container = document.getElementById('form-container')!;
  container.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <span>New QA Receiving Checklist</span>
        <button id="cancel-form" class="btn btn-ghost btn-sm">✕ Cancel</button>
      </div>
      <div class="card-body">
        <div id="form-alert"></div>
        <form id="qa-form">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">PO Number <span class="required">*</span></label>
              <input type="text" id="poNumber" class="form-control" placeholder="PO-10042" required />
            </div>
            <div class="form-group">
              <label class="form-label">Supplier Name <span class="required">*</span></label>
              <input type="text" id="supplierName" class="form-control" placeholder="Allied Packaging Co." required />
            </div>
            <div class="form-group">
              <label class="form-label">Item Code <span class="required">*</span></label>
              <input type="text" id="itemCode" class="form-control" placeholder="RM-FLOUR-BREAD-50LB" required />
            </div>
            <div class="form-group">
              <label class="form-label">Item Description <span class="required">*</span></label>
              <input type="text" id="itemDescription" class="form-control" placeholder="Bread Flour, 50 lb bag" required />
            </div>
            <div class="form-group">
              <label class="form-label">Qty Received <span class="required">*</span></label>
              <input type="number" id="quantityReceived" class="form-control" placeholder="500" required />
            </div>
            <div class="form-group">
              <label class="form-label">UOM <span class="required">*</span></label>
              <input type="text" id="uom" class="form-control" placeholder="BAG" required />
            </div>
            <div class="form-group">
              <label class="form-label">Lot Number</label>
              <input type="text" id="lotNumber" class="form-control" placeholder="GM-240320-A" />
            </div>
            <div class="form-group">
              <label class="form-label">Best By Date</label>
              <input type="date" id="bestByDate" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">Temperature at Receipt (°F)</label>
              <input type="number" id="temperatureAtReceipt" class="form-control" placeholder="38" />
            </div>
            <div class="form-group">
              <label class="form-label">Required Temperature (°F)</label>
              <input type="number" id="temperatureRequired" class="form-control" placeholder="34-40" />
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <div style="font-weight:600;margin-bottom:10px;">Inspection Checklist</div>
            <div class="form-check"><input type="checkbox" id="coaPresent" /><label for="coaPresent">Certificate of Analysis (CoA) present</label></div>
            <div class="form-check"><input type="checkbox" id="coaMatchesLot" /><label for="coaMatchesLot">CoA lot number matches delivery</label></div>
            <div class="form-check"><input type="checkbox" id="packagingIntact" /><label for="packagingIntact">Packaging intact — no tears, moisture damage</label></div>
            <div class="form-check"><input type="checkbox" id="noForeignMaterial" /><label for="noForeignMaterial">No foreign material or pest evidence</label></div>
            <div class="form-check"><input type="checkbox" id="labelingCorrect" /><label for="labelingCorrect">Labeling correct and legible</label></div>
            <div class="form-check"><input type="checkbox" id="allergenVerified" /><label for="allergenVerified">Allergen declaration verified</label></div>
            <div class="form-check"><input type="checkbox" id="pesticideTestRequired" /><label for="pesticideTestRequired">Pesticide test required</label></div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Disposition <span class="required">*</span></label>
              <select id="disposition" class="form-control" required>
                <option value="">Select…</option>
                <option value="accepted">✓ Accepted</option>
                <option value="conditional_accept">⚠ Conditional Accept</option>
                <option value="on_hold">⏸ On Hold</option>
                <option value="rejected">✗ Rejected</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Hold / Rejection Reason</label>
              <input type="text" id="holdReason" class="form-control" placeholder="Required if on hold or rejected" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea id="notes" class="form-control" rows="2" placeholder="Additional observations…"></textarea>
          </div>

          <div style="display:flex;gap:12px;justify-content:flex-end;">
            <button type="button" id="cancel-form-2" class="btn btn-ghost">Cancel</button>
            <button type="submit" id="submit-btn" class="btn btn-primary">Submit & Sign Off</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const cancel = () => { container.innerHTML = ''; };
  document.getElementById('cancel-form')?.addEventListener('click', cancel);
  document.getElementById('cancel-form-2')?.addEventListener('click', cancel);

  document.getElementById('qa-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    const chk = (id: string) => (document.getElementById(id) as HTMLInputElement).checked;
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;

    try {
      await api.createQaChecklist({
        poNumber: val('poNumber'),
        supplierName: val('supplierName'),
        itemCode: val('itemCode'),
        itemDescription: val('itemDescription'),
        quantityReceived: parseFloat(val('quantityReceived')),
        uom: val('uom'),
        lotNumber: val('lotNumber') || undefined,
        bestByDate: val('bestByDate') || undefined,
        temperatureAtReceipt: val('temperatureAtReceipt') ? parseFloat(val('temperatureAtReceipt')) : undefined,
        temperatureRequired: val('temperatureRequired') ? parseFloat(val('temperatureRequired')) : undefined,
        coaPresent: chk('coaPresent'),
        coaMatchesLot: chk('coaMatchesLot'),
        packagingIntact: chk('packagingIntact'),
        noForeignMaterial: chk('noForeignMaterial'),
        labelingCorrect: chk('labelingCorrect'),
        allergenVerified: chk('allergenVerified'),
        pesticideTestRequired: chk('pesticideTestRequired'),
        disposition: val('disposition'),
        holdReason: val('holdReason') || undefined,
        notes: val('notes') || undefined,
      });

      renderQaChecklists();
    } catch (err) {
      document.getElementById('form-alert')!.innerHTML =
        `<div class="alert alert-danger">${err instanceof Error ? err.message : 'Submit failed'}</div>`;
      btn.disabled = false;
      btn.textContent = 'Submit & Sign Off';
    }
  });
}
