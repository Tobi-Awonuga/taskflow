/**
 * Navigate directly to each module by clicking the correct sidebar links.
 * Uses the real sub-item text discovered from screenshots.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.MASTERPLAN_BASE_URL ?? 'https://preview.masterplansolutions.com/';
if (!existsSync('./screenshots')) mkdirSync('./screenshots', { recursive: true });

const rawProxy = process.env.HTTP_PROXY || '';
let proxyConfig;
if (rawProxy) {
  const u = new URL(rawProxy);
  proxyConfig = { server: `http://${u.hostname}:${u.port}`, username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) };
}

const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors'],
  proxy: proxyConfig,
});

const context = await browser.newContext({
  ignoreHTTPSErrors: true, proxy: proxyConfig,
  viewport: { width: 1440, height: 900 },
  storageState: './session-authed.json',
});
const page = await context.newPage();
const notes = {};
let idx = 0;

async function shot(name, note = '') {
  const file = join('screenshots', `mod-${String(++idx).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${file}${note ? ' — '+note : ''}`);
  notes[name] = { file, url: page.url(), note };
  return file;
}

async function getData() {
  return page.evaluate(() => ({
    title: document.title,
    h1: Array.from(document.querySelectorAll('h1,h2,h3')).map(h=>h.textContent.trim()).filter(Boolean).slice(0,6),
    text: document.body.innerText.slice(0, 6000),
    inputs: Array.from(document.querySelectorAll('input,select,textarea')).map(el => ({
      type: el.type, name: el.name, id: el.id, placeholder: el.placeholder,
      required: el.required, label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()??'',
      tag: el.tagName,
    })).filter(f => f.name || f.id || f.placeholder),
    tableHeaders: Array.from(document.querySelectorAll('th')).map(th=>th.textContent.trim()).filter(Boolean).slice(0,40),
    buttons: Array.from(document.querySelectorAll('button,input[type=submit]')).map(b=>(b.textContent||b.value||'').trim()).filter(Boolean).slice(0,20),
    dropdowns: Array.from(document.querySelectorAll('select')).map(s=>({
      name: s.name, id: s.id,
      options: Array.from(s.options).map(o=>o.text).slice(0,20),
    })),
  }));
}

// Click parent then child in sidebar
async function nav(parent, child) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(800);
  // Click parent
  try {
    await page.click(`text="${parent}"`, { timeout: 5000 });
    await page.waitForTimeout(600);
  } catch { console.log(`  ⚠ Parent "${parent}" not clickable`); }
  // Click child
  try {
    await page.click(`text="${child}"`, { timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(()=>{});
    console.log(`  ✓ Navigated: ${parent} → ${child} (${page.url()})`);
    return true;
  } catch {
    console.log(`  ⚠ Could not click "${child}"`);
    return false;
  }
}

// Verify session
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
if (page.url().includes('SignIn')) { console.error('Session expired'); await browser.close(); process.exit(1); }
console.log('✅ Session valid\n');

// ── 1. Item Master ────────────────────────────────────────────────────────
console.log('🔍 Item Master');
await nav('Items', 'Item Master');
await shot('item-master', 'Full item master list');
const itemMasterData = await getData();
notes['item_master'] = itemMasterData;
console.log('  Title:', itemMasterData.title);
console.log('  Columns:', itemMasterData.tableHeaders.join(', '));
console.log('  Buttons:', itemMasterData.buttons.join(', '));

// ── 2. New Item form ──────────────────────────────────────────────────────
console.log('\n🔍 New Item Form');
try {
  await page.click('text="New Item"', { timeout: 3000 });
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(()=>{});
} catch {
  // Look for any "New" or "Add" button
  const btn = await page.$('button:has-text("New"), button:has-text("Add"), button:has-text("Create"), a:has-text("New Item")');
  if (btn) { await btn.click(); await page.waitForTimeout(2000); }
}
await shot('new-item', 'New item creation form');
const newItemData = await getData();
notes['new_item'] = newItemData;
console.log('  Title:', newItemData.title);
console.log('  Fields:', newItemData.inputs.map(i=>`${i.label||i.name||i.id}${i.required?'*':''}`).join(' | '));
console.log('  Dropdowns:', newItemData.dropdowns.map(d=>`${d.name||d.id}(${d.options.slice(0,5).join(',')})`).join(' | '));

// ── 3. Item List ──────────────────────────────────────────────────────────
console.log('\n🔍 Item List');
await nav('Items', 'Item List');
await shot('item-list', 'Item list with all items');
notes['item_list'] = await getData();
console.log('  Columns:', notes['item_list'].tableHeaders.join(', '));

// ── 4. Purchase Orders ────────────────────────────────────────────────────
console.log('\n🔍 Purchase Orders');
await nav('Purchasing', 'Purchase Orders');
await shot('purchase-orders', 'Purchase orders transaction screen');
const poData = await getData();
notes['purchase_orders'] = poData;
console.log('  Title:', poData.title);
console.log('  Columns:', poData.tableHeaders.join(', '));
console.log('  Buttons:', poData.buttons.join(', '));

// ── 5. New PO ─────────────────────────────────────────────────────────────
console.log('\n🔍 New Purchase Order form');
const newPoBtn = await page.$('button:has-text("New"), button:has-text("New Purchase Order"), a:has-text("New")');
if (newPoBtn) {
  await newPoBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(()=>{});
  await shot('new-po', 'New PO form');
  const d = await getData();
  notes['new_po'] = d;
  console.log('  Fields:', d.inputs.map(i=>`${i.label||i.name||i.id}${i.required?'*':''}`).join(' | '));
}

// ── 6. Goods Receipt / Receiving ──────────────────────────────────────────
console.log('\n🔍 Goods Receipt (PO Receiving)');
await nav('Purchasing', 'Goods Receipt');
await shot('goods-receipt', 'Goods receipt / PO receiving screen');
const grData = await getData();
notes['goods_receipt'] = grData;
console.log('  Title:', grData.title);
console.log('  Fields:', grData.inputs.slice(0,10).map(i=>`${i.label||i.name||i.id}`).join(' | '));
console.log('  Columns:', grData.tableHeaders.join(', '));

// ── 7. Production Orders ──────────────────────────────────────────────────
console.log('\n🔍 Production Orders');
await nav('Manufacturing', 'Production Orders');
await shot('production-orders', 'Production orders list');
const prodData = await getData();
notes['production_orders'] = prodData;
console.log('  Title:', prodData.title);
console.log('  Columns:', prodData.tableHeaders.join(', '));
console.log('  Buttons:', prodData.buttons.join(', '));

// ── 8. Production Schedule ────────────────────────────────────────────────
console.log('\n🔍 Production Schedule');
await nav('Manufacturing', 'Production Schedule');
await shot('production-schedule', 'Production schedule view');
notes['production_schedule'] = await getData();

// ── 9. Open Production Orders ─────────────────────────────────────────────
console.log('\n🔍 Open Production Orders');
await nav('Manufacturing', 'Open Production Orders');
await shot('open-production-orders', 'Open production orders list');
const openProdData = await getData();
notes['open_production_orders'] = openProdData;
console.log('  Columns:', openProdData.tableHeaders.join(', '));

// ── 10. Transfer Orders ───────────────────────────────────────────────────
console.log('\n🔍 Transfer Orders');
await nav('Items', 'Transfer Order');
await shot('transfer-orders', 'Transfer orders');
const toData = await getData();
notes['transfer_orders'] = toData;
console.log('  Title:', toData.title);
console.log('  Columns:', toData.tableHeaders.join(', '));
console.log('  Buttons:', toData.buttons.join(', '));

// ── 11. New Transfer Order ────────────────────────────────────────────────
console.log('\n🔍 New Transfer Order form');
const newToBtn = await page.$('button:has-text("New Transfer Order"), button:has-text("New"), a:has-text("New")');
if (newToBtn) {
  await newToBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(()=>{});
  await shot('new-transfer-order', 'New transfer order form');
  const d = await getData();
  notes['new_transfer_order'] = d;
  console.log('  Fields:', d.inputs.slice(0,12).map(i=>`${i.label||i.name||i.id}${i.required?'*':''}`).join(' | '));
}

// ── 12. Traceability ──────────────────────────────────────────────────────
console.log('\n🔍 Traceability');
await nav('Items', 'Traceability');
await shot('traceability', 'Traceability screen');
const traceData = await getData();
notes['traceability'] = traceData;
console.log('  Title:', traceData.title);
console.log('  Fields:', traceData.inputs.slice(0,8).map(i=>`${i.label||i.name||i.id}`).join(' | '));

// ── 13. Cycle Count ───────────────────────────────────────────────────────
console.log('\n🔍 Cycle Count');
await nav('Items', 'Cycle Count');
await shot('cycle-count', 'Cycle count screen');
const ccData = await getData();
notes['cycle_count'] = ccData;
console.log('  Title:', ccData.title);
console.log('  Columns:', ccData.tableHeaders.join(', '));

// ── 14. Sales Orders ──────────────────────────────────────────────────────
console.log('\n🔍 Sales Orders');
await nav('Sales', 'Sales Orders');
await shot('sales-orders', 'Sales orders list');
const soData = await getData();
notes['sales_orders'] = soData;
console.log('  Title:', soData.title);
console.log('  Columns:', soData.tableHeaders.join(', '));
console.log('  Buttons:', soData.buttons.join(', '));

// ── 15. Shipping ──────────────────────────────────────────────────────────
console.log('\n🔍 Shipping');
await nav('Sales', 'Shipping');
await shot('shipping', 'Shipping screen');
const shipData = await getData();
notes['shipping'] = shipData;
console.log('  Title:', shipData.title);
console.log('  Columns:', shipData.tableHeaders.join(', '));
console.log('  Buttons:', shipData.buttons.join(', '));

// ── 16. Quality — Inspection Holds ───────────────────────────────────────
console.log('\n🔍 Quality — Inspection Holds');
await nav('Quality', 'Inspection Holds');
await shot('inspection-holds', 'QA inspection holds');
const ihData = await getData();
notes['inspection_holds'] = ihData;
console.log('  Title:', ihData.title);
console.log('  Columns:', ihData.tableHeaders.join(', '));

// ── 17. Quality — Non-Conformance ─────────────────────────────────────────
console.log('\n🔍 Quality — Non-Conformance');
await nav('Quality', 'Non-Conformance');
await shot('non-conformance', 'Non-conformance screen');
notes['non_conformance'] = await getData();

// ── 18. Open Non-Conformances ─────────────────────────────────────────────
console.log('\n🔍 Open Non-Conformances');
await nav('Quality', 'Open Non-Conformances');
await shot('open-non-conformances', 'Open non-conformances list');
const ncData = await getData();
notes['open_nc'] = ncData;
console.log('  Columns:', ncData.tableHeaders.join(', '));

// ── 19. Quality Documents ─────────────────────────────────────────────────
console.log('\n🔍 Quality Documents');
await nav('Quality', 'Quality Documents');
await shot('quality-documents', 'Quality documents list');
notes['quality_docs'] = await getData();

// ── 20. MRP menu ──────────────────────────────────────────────────────────
console.log('\n🔍 MRP');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(500);
await page.click('text="MRP"').catch(()=>{});
await page.waitForTimeout(1000);
await shot('mrp-menu', 'MRP menu expanded');
notes['mrp'] = await getData();

// ── 21. PLM ───────────────────────────────────────────────────────────────
console.log('\n🔍 PLM (Product Lifecycle)');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(500);
await page.click('text="PLM"').catch(()=>{});
await page.waitForTimeout(1000);
await shot('plm-menu', 'PLM menu expanded');
notes['plm'] = await getData();
console.log('  PLM items:', notes['plm'].text.slice(0, 300));

writeFileSync('./inspection-report.json', JSON.stringify(notes, null, 2));
console.log(`\n📄 Report saved. ${idx} screenshots.`);
console.log('✅ Module inspection complete!');
await browser.close();
