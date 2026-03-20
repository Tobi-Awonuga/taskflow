import { api } from '../api.js';
import { renderLayout, badge, formatDate, getUser } from '../components/layout.js';

function simpleMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^---$/gm, '<hr />')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul]|<li|<hr)(.*)/gm, (_m, p) => p ? `<p>${p}</p>` : '')
    .replace(/(<p><\/p>)+/g, '');
}

export async function renderSops(): Promise<void> {
  renderLayout('<div class="spinner">Loading…</div>', '/sops');

  const sops = await api.listSops();
  const user = getUser()!;

  const categories = [...new Set(sops.map((s) => s.category))].sort();

  let selectedCategory = '';
  let selectedId: number | null = null;

  function renderPage(): void {
    const filtered = selectedCategory ? sops.filter((s) => s.category === selectedCategory) : sops;

    const listHtml = filtered
      .map(
        (s) => `
      <div class="sop-item ${selectedId === s.id ? 'active' : ''}"
           data-id="${s.id}"
           style="padding:12px 16px;border-bottom:1px solid #e5e7eb;cursor:pointer;${selectedId === s.id ? 'background:#fef3c7;' : ''}">
        <div style="font-weight:500;font-size:14px;">${s.title}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:3px;">
          ${s.docNumber} · v${s.version} · ${formatDate(s.effectiveDate)}
          ${s.acknowledgedByMe ? ' · <span style="color:#059669;">✓ Acknowledged</span>' : ''}
        </div>
      </div>`
      )
      .join('');

    const content = `
      <div class="page-header">
        <div>
          <div class="page-title">SOP Portal</div>
          <div class="page-subtitle">Standard Operating Procedures & Training Documents</div>
        </div>
      </div>

      <div style="display:flex;gap: 0;height:calc(100vh - 180px);">
        <!-- Left: list -->
        <div style="width:300px;flex-shrink:0;border:1px solid #e5e7eb;border-radius:8px;background:#fff;overflow:hidden;display:flex;flex-direction:column;">
          <div style="padding:12px;border-bottom:1px solid #e5e7eb;">
            <select id="category-filter" class="form-control" style="font-size:13px;">
              <option value="">All Categories</option>
              ${categories.map((c) => `<option value="${c}" ${c === selectedCategory ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1;overflow-y:auto;">${listHtml || '<div class="empty-state" style="padding:24px;"><div class="empty-state-text">No SOPs found.</div></div>'}</div>
        </div>

        <!-- Right: viewer -->
        <div style="flex:1;margin-left:20px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;overflow:hidden;display:flex;flex-direction:column;">
          <div id="sop-viewer" style="flex:1;overflow-y:auto;padding:28px;">
            <div class="empty-state" style="padding:60px 24px;">
              <div class="empty-state-icon">📚</div>
              <div class="empty-state-title">Select a document to read</div>
              <div class="empty-state-text">Choose an SOP from the list on the left</div>
            </div>
          </div>
        </div>
      </div>
    `;

    renderLayout(content, '/sops');

    // Category filter
    document.getElementById('category-filter')?.addEventListener('change', (e) => {
      selectedCategory = (e.target as HTMLSelectElement).value;
      renderPage();
    });

    // SOP item click
    document.querySelectorAll('.sop-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const id = parseInt((item as HTMLElement).dataset['id']!);
        selectedId = id;
        const sop = await api.getSop(id);

        const viewer = document.getElementById('sop-viewer')!;
        viewer.innerHTML = `
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
            <div>
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:4px;">${sop.docNumber} · v${sop.version}</div>
              <div style="font-size:20px;font-weight:700;">${sop.title}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">
                Effective: ${formatDate(sop.effectiveDate)}
                ${sop.reviewDate ? ' · Review: ' + formatDate(sop.reviewDate) : ''}
                ${sop.approvedBy ? ' · Approved by: ' + sop.approvedBy : ''}
              </div>
            </div>
            ${!sop.acknowledgedByMe ? `<button class="btn btn-primary btn-sm" id="ack-btn" data-id="${sop.id}">✓ Acknowledge & Accept</button>` : '<span class="badge badge-approved">✓ Acknowledged</span>'}
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:24px;" />
          <div class="md-content">${simpleMarkdown(sop.content)}</div>
        `;

        document.getElementById('ack-btn')?.addEventListener('click', async () => {
          await api.acknowledgeSop(id);
          // Update list
          const sopInList = sops.find((s) => s.id === id);
          if (sopInList) sopInList.acknowledgedByMe = true;
          renderPage();
          // Re-select
          selectedId = id;
          document.querySelector(`.sop-item[data-id="${id}"]`)?.dispatchEvent(new Event('click'));
        });

        // Highlight selected
        document.querySelectorAll('.sop-item').forEach((el) => {
          (el as HTMLElement).style.background = '';
        });
        (item as HTMLElement).style.background = '#fef3c7';
      });
    });
  }

  renderPage();
}
