/**
 * CT Bakery — Item Creation Guard
 * Content script — runs on no1.masterplansolutions.com
 *
 * Detects two item creation paths in Masterplan:
 *   1. New Item  : frmITEMS_ItemMaster.aspx?TimeStamp=<unix>&NewUI=TRUE  (no ItemMasterID)
 *   2. Copy Item : User clicks "Copy to New Item" in the action menu on an
 *                  existing item page. Guard fires on that click, not on page load.
 *
 * Confirmed selectors from DOM recon (2026-03-20):
 *   Save button : #btnSave  (input[type="button"], class="button blue")
 *   Item Number : #txtItemNumber
 *   Item Name   : #txtItemName
 *   Copy modal  : .rwDialogInput becomes visible / element with text "Copy to New Item"
 *   Action menu : #btnOrderTypes (dropdown-toggle that reveals Copy option)
 */

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────────────
  const OVERLAY_ID        = 'ctb-guard-overlay';
  const BYPASS_MODAL_ID   = 'ctb-bypass-modal';
  const SAVE_BTN_ID       = 'btnSave';

  // IDs of main Item Master form fields — used to exclude from copy modal search
  const MAIN_FIELD_IDS = new Set([
    'txtItemNumber', 'txtRevision', 'txtItemName',
    'txtCreateDate', 'txtLastModifiedDate',
  ]);

  // ── State ─────────────────────────────────────────────────────────────────
  let guardActive       = false;
  let detectedMode      = null;   // 'new_item' | 'copy_item'
  let validatedRequest  = null;
  let saveLockObserver  = null;

  // ── URL-based mode detection ──────────────────────────────────────────────
  function getUrlMode() {
    const path   = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);

    if (!path.includes('frmitems_itemmaster.aspx')) return null;

    const hasTimestamp    = params.has('TimeStamp') && /^\d+$/.test(params.get('TimeStamp') || '');
    const hasItemMasterId = params.has('ItemMasterID');

    // New blank item: TimeStamp present, no ItemMasterID
    if (hasTimestamp && !hasItemMasterId) return 'new_item';

    // Existing item page: ItemMasterID present → watch for copy click
    if (hasItemMasterId) return 'existing_item';

    return null;
  }

  // ── Save button helpers ───────────────────────────────────────────────────
  function getSaveBtn() {
    return document.getElementById(SAVE_BTN_ID);
  }

  function lockSave() {
    const btn = getSaveBtn();
    if (!btn) return;
    btn.disabled = true;
    btn.setAttribute('data-ctb-locked', '1');
    btn.title = 'Item Creation Guard: Enter approved Request ID to proceed';
  }

  function unlockSave() {
    const btn = getSaveBtn();
    if (!btn) return;
    btn.disabled = false;
    btn.removeAttribute('data-ctb-locked');
    btn.title = '';

    if (saveLockObserver) {
      saveLockObserver.disconnect();
      saveLockObserver = null;
    }
  }

  // Re-lock if Masterplan's own JS re-enables the button while guard is active
  function watchSaveLock() {
    saveLockObserver = new MutationObserver(() => {
      if (!guardActive) return;
      const btn = getSaveBtn();
      if (btn && !btn.disabled) lockSave();
    });
    saveLockObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled'],
    });
  }

  // ── Copy modal detection ──────────────────────────────────────────────────
  // Telerik RadWindow pre-renders dialogs as hidden DOM nodes.
  // When "Copy to New Item" is clicked, the wrapper becomes visible.
  // We detect either:
  //   (a) .rwDialogInput becoming visible (RadWindow prompt field), OR
  //   (b) any visible element whose trimmed text is exactly "Copy to New Item"

  function findCopyModalContainer() {
    // Strategy A: look for visible .rwDialogInput (Telerik RadWindow input)
    const radInputs = document.querySelectorAll('.rwDialogInput');
    for (const el of radInputs) {
      if (el.offsetParent !== null) return el.closest('.rwDialogPopup, .rwContent, div') || el.parentElement;
    }

    // Strategy B: walk the DOM for a visible "Copy to New Item" heading
    const allEls = document.querySelectorAll('td, div, span, h2, h3, h4');
    for (const el of allEls) {
      if (el.children.length > 2) continue;
      const text = (el.textContent || '').trim();
      if (text === 'Copy to New Item' && el.offsetParent !== null) {
        let container = el.parentElement;
        while (container && container !== document.body) {
          if (container.querySelectorAll('input[type="text"]').length >= 1) return container;
          container = container.parentElement;
        }
        return el.parentElement;
      }
    }

    return null;
  }

  // ── Find copy modal inputs ────────────────────────────────────────────────
  function getCopyModalInputs(container) {
    const result = { itemNumber: null, itemName: null };
    if (!container) return result;

    const rwInputs = container.querySelectorAll('.rwDialogInput');
    if (rwInputs.length >= 1) {
      result.itemNumber = rwInputs[0];
      if (rwInputs.length >= 2) result.itemName = rwInputs[1];
      return result;
    }

    const rows = container.querySelectorAll('tr, div');
    for (const row of rows) {
      const text  = row.textContent || '';
      const input = row.querySelector('input[type="text"]');
      if (!input) continue;
      if (text.includes('New Item Number') && !result.itemNumber) result.itemNumber = input;
      if (text.includes('New Item Name')   && !result.itemName)   result.itemName   = input;
    }

    return result;
  }

  // ── Copy click interception ───────────────────────────────────────────────
  // Instead of watching DOM mutations on page load (which fires too early on
  // pre-rendered Telerik dialogs), we listen for the user's actual click on
  // "Copy to New Item" and only THEN start watching for the modal to appear.

  function watchForCopyClick() {
    document.addEventListener('click', onCopyClickCapture, true);
  }

  function onCopyClickCapture(e) {
    if (guardActive) return;

    // Walk up from the clicked element looking for "Copy to New Item" text
    let node = e.target;
    while (node && node !== document.body) {
      const text = (node.textContent || '').trim();
      if (text === 'Copy to New Item') {
        document.removeEventListener('click', onCopyClickCapture, true);
        detectedMode = 'copy_item';
        // Let Masterplan's click handler run first, then watch for its modal
        setTimeout(watchForModalAfterCopyClick, 50);
        return;
      }
      node = node.parentElement;
    }
  }

  function watchForModalAfterCopyClick() {
    // If the modal is already visible (fast render), go straight to inject
    const container = findCopyModalContainer();
    if (container) {
      injectOverlay('copy_item');
      return;
    }

    // Otherwise watch for it to appear — give up after 3 s
    const timeout = setTimeout(() => observer.disconnect(), 3000);

    const observer = new MutationObserver(() => {
      const c = findCopyModalContainer();
      if (c) {
        observer.disconnect();
        clearTimeout(timeout);
        injectOverlay('copy_item');
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'display'],
    });
  }

  // ── Overlay injection ─────────────────────────────────────────────────────
  function injectOverlay(mode) {
    if (document.getElementById(OVERLAY_ID)) return;
    guardActive = true;

    const isCopy = mode === 'copy_item';

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div id="ctb-header">
        <span id="ctb-logo">🍞</span>
        <span id="ctb-title">Item Creation Guard</span>
        <span id="ctb-brand">CT Bakery</span>
      </div>

      ${isCopy ? `
      <div id="ctb-copy-warning">
        <strong>⚠ COPY DETECTED</strong> — Review ALL prefilled fields before saving.
        Copied data may be outdated or incorrect:
        <ul>
          <li>Item Name &amp; Description</li>
          <li>Category / Product Code</li>
          <li>Unit of Measure (UOM)</li>
          <li>Standard Cost</li>
          <li>Preferred Supplier</li>
        </ul>
      </div>` : ''}

      <div id="ctb-notice">
        <strong>Before proceeding:</strong>
        <ul>
          <li>Send an email confirming the item specs with the requester</li>
          <li>Verify all specs against the <strong>FPS file on the T-drive</strong> before creating this item</li>
          <li>Questions? Contact ERP: <a href="mailto:tobi.awonuga@ctbakery.com">tobi.awonuga@ctbakery.com</a></li>
        </ul>
      </div>

      <div id="ctb-body">
        <p>An approved request is required before creating a new item in Masterplan.</p>
        <div class="ctb-input-row">
          <input
            id="ctb-request-input"
            type="text"
            placeholder="Approved request number"
            autocomplete="off"
            spellcheck="false"
          />
          <button id="ctb-validate-btn">Validate →</button>
        </div>
        <div id="ctb-validate-status" class="ctb-status" aria-live="polite"></div>
      </div>

      <div id="ctb-approved" hidden>
        <div id="ctb-approved-badge">✅ Request Approved</div>
        <table id="ctb-spec-table">
          <tbody>
            <tr><th>Proposed Code</th><td id="ctb-s-code">—</td></tr>
            <tr><th>Item Name</th>    <td id="ctb-s-name">—</td></tr>
            <tr><th>Category</th>     <td id="ctb-s-cat">—</td></tr>
            <tr><th>Item Type</th>    <td id="ctb-s-type">—</td></tr>
            <tr><th>UOM</th>          <td id="ctb-s-uom">—</td></tr>
          </tbody>
        </table>
        <p class="ctb-instr">
          Enter the item in Masterplan exactly as shown above, then record the
          final item code below to close this request.
        </p>
        <div class="ctb-input-row">
          <input
            id="ctb-code-input"
            type="text"
            placeholder="Final Masterplan item code"
            autocomplete="off"
            spellcheck="false"
          />
          <button id="ctb-complete-btn">Mark as Created ✓</button>
        </div>
        <div id="ctb-complete-status" class="ctb-status" aria-live="polite"></div>
      </div>

      <div id="ctb-footer">
        <button id="ctb-bypass-btn">Proceed without approval — I accept responsibility</button>
      </div>
    `;

    document.body.appendChild(overlay);

    lockSave();
    watchSaveLock();

    document.getElementById('ctb-validate-btn').addEventListener('click', handleValidate);
    document.getElementById('ctb-request-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleValidate();
    });
    document.getElementById('ctb-complete-btn').addEventListener('click', handleComplete);
    document.getElementById('ctb-bypass-btn').addEventListener('click', handleBypassClick);
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  async function handleValidate() {
    const input         = document.getElementById('ctb-request-input');
    const statusEl      = document.getElementById('ctb-validate-status');
    const requestNumber = (input?.value || '').trim().toUpperCase();

    if (!requestNumber) {
      setStatus(statusEl, 'error', 'Please enter a request number.');
      return;
    }

    setStatus(statusEl, 'loading', 'Validating…');
    document.getElementById('ctb-validate-btn').disabled = true;

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'VALIDATE_REQUEST',
        requestNumber,
      });

      if (result.error) {
        setStatus(statusEl, 'error', result.error);
        document.getElementById('ctb-validate-btn').disabled = false;
        return;
      }

      validatedRequest = result.request;
      showApprovedSpec(result.request);
      setStatus(statusEl, '', '');
    } catch (err) {
      setStatus(statusEl, 'error',
        'Could not reach the CT Bakery portal. Check your connection or use bypass if urgent.'
      );
      document.getElementById('ctb-validate-btn').disabled = false;
    }
  }

  function showApprovedSpec(req) {
    document.getElementById('ctb-body').hidden    = true;
    document.getElementById('ctb-approved').hidden = false;

    document.getElementById('ctb-s-code').textContent = req.proposedCode || '—';
    document.getElementById('ctb-s-name').textContent = req.proposedName || '—';
    document.getElementById('ctb-s-cat').textContent  = req.category     || '—';
    document.getElementById('ctb-s-type').textContent = req.itemType     || '—';
    document.getElementById('ctb-s-uom').textContent  = req.uom          || '—';

    if (detectedMode === 'copy_item') {
      prefillCopyModal(req.proposedCode, req.proposedName);
    }
  }

  // ── Prefill copy modal ────────────────────────────────────────────────────
  function prefillCopyModal(code, name) {
    const container = findCopyModalContainer();
    const { itemNumber, itemName } = getCopyModalInputs(container);

    function fillInput(el, value) {
      if (!el) return;
      el.removeAttribute('readonly');
      el.removeAttribute('disabled');
      el.value = value;
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    fillInput(itemNumber, code);
    fillInput(itemName,   name);
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  async function handleComplete() {
    const codeInput      = document.getElementById('ctb-code-input');
    const statusEl       = document.getElementById('ctb-complete-status');
    const masterplanCode = (codeInput?.value || '').trim().toUpperCase();

    if (!masterplanCode) {
      setStatus(statusEl, 'error', 'Please enter the Masterplan item code.');
      return;
    }
    if (!validatedRequest) {
      setStatus(statusEl, 'error', 'No validated request. Please re-validate.');
      return;
    }

    setStatus(statusEl, 'loading', 'Recording…');
    document.getElementById('ctb-complete-btn').disabled = true;

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'COMPLETE_REQUEST',
        requestId:      validatedRequest.id,
        masterplanCode,
        creationPath:   detectedMode === 'copy_item' ? 'copy' : 'new',
      });

      if (result.error) {
        setStatus(statusEl, 'error', result.error);
        document.getElementById('ctb-complete-btn').disabled = false;
        return;
      }

      setStatus(statusEl, 'success',
        `✅ Recorded. Request ${validatedRequest.requestNumber} is now complete.`
      );
      codeInput.disabled = true;
      unlockSave();
    } catch (err) {
      setStatus(statusEl, 'error',
        'Could not reach server. Note the code manually and update the portal later.'
      );
      document.getElementById('ctb-complete-btn').disabled = false;
    }
  }

  // ── Bypass — show custom modal instead of window.confirm ──────────────────
  function handleBypassClick() {
    if (document.getElementById(BYPASS_MODAL_ID)) return;

    const modal = document.createElement('div');
    modal.id = BYPASS_MODAL_ID;
    modal.innerHTML = `
      <div id="ctb-bypass-box">
        <div id="ctb-bypass-box-header">
          <span>⚠</span> Bypass Item Creation Guard
        </div>
        <div id="ctb-bypass-box-body">
          <p>Proceeding without an approved request bypasses the item governance process.</p>
          <p><strong>This bypass will be logged with your name and timestamp and reviewed by management.</strong></p>
        </div>
        <div id="ctb-bypass-box-actions">
          <button id="ctb-bypass-cancel">Cancel</button>
          <button id="ctb-bypass-confirm">I Accept Responsibility — Proceed</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('ctb-bypass-cancel').addEventListener('click', () => {
      modal.remove();
    });

    document.getElementById('ctb-bypass-confirm').addEventListener('click', async () => {
      modal.remove();

      chrome.runtime.sendMessage({
        type:      'LOG_BYPASS',
        url:       window.location.href,
        mode:      detectedMode,
        timestamp: new Date().toISOString(),
      }).catch(() => {});

      unlockSave();
      guardActive = false;
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay) overlay.remove();
    });
  }

  // ── Status helper ─────────────────────────────────────────────────────────
  function setStatus(el, type, msg) {
    if (!el) return;
    el.textContent = msg;
    el.className   = `ctb-status${type ? ' ctb-status-' + type : ''}`;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    const urlMode = getUrlMode();

    if (urlMode === 'new_item') {
      detectedMode = 'new_item';
      const poll = setInterval(() => {
        if (getSaveBtn()) {
          clearInterval(poll);
          injectOverlay('new_item');
        }
      }, 150);

    } else if (urlMode === 'existing_item') {
      // Stay dormant — only activate when user explicitly clicks "Copy to New Item"
      watchForCopyClick();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
