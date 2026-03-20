/**
 * Deep inspection using authenticated session + sidebar click navigation.
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
  ignoreHTTPSErrors: true,
  proxy: proxyConfig,
  viewport: { width: 1440, height: 900 },
  storageState: './session-authed.json',
});

const page = await context.newPage();
const notes = {};
let idx = 0;

async function shot(name, note = '') {
  const file = join('screenshots', `deep-${String(++idx).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${file}${note ? ' — '+note : ''}`);
  notes[name] = { file, url: page.url(), note };
  return file;
}

async function pageData(key) {
  const d = await page.evaluate(() => ({
    title: document.title,
    url: window.location.href,
    h1: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent.trim()).filter(Boolean).slice(0, 8),
    text: document.body.innerText.slice(0, 5000),
    inputs: Array.from(document.querySelectorAll('input,select,textarea')).map(el => ({
      tag: el.tagName, type: el.type, name: el.name, id: el.id,
      placeholder: el.placeholder, required: el.required,
      label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ?? '',
    })).filter(f => f.name || f.id || f.placeholder),
    buttons: Array.from(document.querySelectorAll('button,input[type=submit]'))
      .map(b => (b.textContent || b.value || '').trim()).filter(Boolean).slice(0, 20),
    tableHeaders: Array.from(document.querySelectorAll('th'))
      .map(th => th.textContent.trim()).filter(Boolean).slice(0, 30),
    links: Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim().slice(0,50), href: a.getAttribute('href') }))
      .filter(a => a.text).slice(0, 40),
  }));
  notes[key] = d;
  return d;
}

async function clickSidebarItem(text) {
  // Try sidebar/nav click by text
  const selectors = [
    `nav li:has-text("${text}")`,
    `.sidebar li:has-text("${text}")`,
    `[class*="nav"] li:has-text("${text}")`,
    `li:has-text("${text}")`,
    `a:has-text("${text}")`,
    `span:has-text("${text}")`,
    `div:has-text("${text}")`,
  ];
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page.waitForTimeout(1500);
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
        return true;
      }
    } catch {}
  }
  return false;
}

async function clickSubItem(parentText, childText) {
  // First expand parent
  await clickSidebarItem(parentText);
  await page.waitForTimeout(800);
  // Then click child
  try {
    // Look for the child text within an expanded submenu
    const child = await page.$(`li:has-text("${childText}") a, a:has-text("${childText}")`);
    if (child) {
      await child.click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      return true;
    }
  } catch {}
  return false;
}

// ── Verify session still valid ────────────────────────────────────────────
console.log('Loading authenticated session…');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(2000);

if (page.url().includes('SignIn')) {
  console.error('❌ Session expired. Need to re-login with a new OTP.');
  await browser.close();
  process.exit(1);
}

console.log('✅ Session valid. URL:', page.url());
await shot('home', 'Dashboard home');
const homeData = await pageData('home');
console.log('Dashboard title:', homeData.title);

// Capture full sidebar structure
const sidebarData = await page.evaluate(() => {
  const sidebar = document.querySelector('nav, .sidebar, [class*="sidebar"], [class*="nav"]');
  if (!sidebar) return { html: 'not found', text: '' };
  return {
    text: sidebar.innerText,
    items: Array.from(sidebar.querySelectorAll('li, a')).map(el => el.textContent.trim()).filter(Boolean),
    html: sidebar.innerHTML.slice(0, 3000),
  };
});
notes['sidebar_structure'] = sidebarData;
console.log('\nSidebar items:', sidebarData.items?.slice(0, 30).join(' | '));

// ── Items / Item Master ───────────────────────────────────────────────────
console.log('\n🔍 Items menu');
await clickSidebarItem('Items');
await page.waitForTimeout(1000);
await shot('items-menu-open', 'Items menu expanded');

// Try clicking sub-items
for (const sub of ['Items', 'Item Master', 'Item List', 'Search Items']) {
  const found = await page.$(`a:has-text("${sub}"), li:has-text("${sub}") a`);
  if (found) {
    console.log(`  Found sub-item: ${sub}`);
    await found.click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    break;
  }
}
await shot('item-list', 'Item master list');
const itemData = await pageData('item_list');
console.log('  Title:', itemData.title, '| H1:', itemData.h1[0]);
console.log('  Table headers:', itemData.tableHeaders.join(', '));
console.log('  Buttons:', itemData.buttons.slice(0, 8).join(', '));

// ── New Item form ─────────────────────────────────────────────────────────
console.log('\n🔍 New Item form');
const newBtn = await page.$('button:has-text("New"), button:has-text("Add"), a:has-text("New Item"), button:has-text("Create"), [class*="btn-primary"]');
if (newBtn) {
  await newBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await shot('new-item-form', 'New item creation form');
  const newItemData = await pageData('new_item_form');
  console.log('  Inputs:', newItemData.inputs.map(i => `${i.label||i.name||i.id} (${i.type}${i.required?'*':''})`).join(' | '));
  // Go back
  await page.goBack().catch(() => {});
  await page.waitForTimeout(1000);
} else {
  console.log('  No "New" button found on item list');
  // Try URL
  const currentUrl = page.url();
  if (currentUrl.includes('Items') || currentUrl.includes('item')) {
    await page.goto(currentUrl.replace(/\/?$/, '/Create'), { waitUntil: 'networkidle', timeout: 8000 }).catch(() => {});
    await shot('new-item-form-url', 'New item via URL /Create');
    const d = await pageData('new_item_form');
    console.log('  Inputs:', d.inputs.map(i => `${i.label||i.name||i.id}`).join(' | '));
  }
}

// ── Purchasing ────────────────────────────────────────────────────────────
console.log('\n🔍 Purchasing menu');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
await page.waitForTimeout(1000);
await clickSidebarItem('Purchasing');
await page.waitForTimeout(1000);
await shot('purchasing-menu', 'Purchasing menu expanded');

// Purchase Orders
for (const sub of ['Purchase Orders', 'PO List', 'Purchase Order', 'Orders']) {
  const found = await page.$(`a:has-text("${sub}"), li:has-text("${sub}") a`);
  if (found) { await found.click(); await page.waitForTimeout(2000); await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); break; }
}
await shot('purchase-orders', 'Purchase orders list');
const poData = await pageData('purchase_orders');
console.log('  Title:', poData.title, '| Headers:', poData.tableHeaders.slice(0,8).join(', '));

// PO Receiving
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
await page.waitForTimeout(500);
await clickSidebarItem('Purchasing');
await page.waitForTimeout(800);
for (const sub of ['Receiving', 'Receive', 'PO Receiving', 'Receipts', 'Receipt']) {
  const found = await page.$(`a:has-text("${sub}"), li:has-text("${sub}") a`);
  if (found) { await found.click(); await page.waitForTimeout(2000); await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); break; }
}
await shot('po-receiving', 'PO Receiving screen');
const recData = await pageData('po_receiving');
console.log('  Title:', recData.title, '| Inputs:', recData.inputs.slice(0,5).map(i=>i.label||i.name||i.id).join(', '));

// ── Manufacturing ─────────────────────────────────────────────────────────
console.log('\n🔍 Manufacturing menu');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
await page.waitForTimeout(500);
await clickSidebarItem('Manufacturing');
await page.waitForTimeout(1000);
await shot('manufacturing-menu', 'Manufacturing menu expanded');

for (const sub of ['Production Orders', 'Work Orders', 'Production', 'Manufacturing Orders']) {
  const found = await page.$(`a:has-text("${sub}"), li:has-text("${sub}") a`);
  if (found) { await found.click(); await page.waitForTimeout(2000); await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); break; }
}
await shot('production-orders', 'Production orders');
const prodData = await pageData('production_orders');
console.log('  Title:', prodData.title, '| Headers:', prodData.tableHeaders.slice(0,8).join(', '));

// Transfer Orders (likely under Manufacturing or Inventory)
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
await page.waitForTimeout(500);
for (const parent of ['Manufacturing', 'Items', 'MRP']) {
  await clickSidebarItem(parent);
  await page.waitForTimeout(800);
  for (const sub of ['Transfer Orders', 'Transfers', 'Transfer Order']) {
    const found = await page.$(`a:has-text("${sub}"), li:has-text("${sub}") a`);
    if (found) {
      await found.click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      const d = await pageData('transfer_orders');
      if (!page.url().includes('SignIn') && d.title !== 'Dashboard | Masterplan ERP') {
        await shot('transfer-orders', 'Transfer orders');
        console.log('  Transfer Orders found under:', parent, '| Title:', d.title);
        break;
      }
    }
  }
  if (notes['transfer_orders']?.title && notes['transfer_orders'].title !== 'Dashboard | Masterplan ERP') break;
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
  await page.waitForTimeout(500);
}
if (!notes['transfer_orders'] || notes['transfer_orders'].title === 'Dashboard | Masterplan ERP') {
  await shot('transfer-orders', 'Transfer orders — not found');
  console.log('  ⚠ Transfer Orders not found in nav');
}

// ── Sales ─────────────────────────────────────────────────────────────────
console.log('\n🔍 Sales menu');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
await page.waitForTimeout(500);
await clickSidebarItem('Sales');
await page.waitForTimeout(1000);
await shot('sales-menu', 'Sales menu expanded');

for (const sub of ['Sales Orders', 'Sales Order', 'Orders', 'Order List']) {
  const found = await page.$(`a:has-text("${sub}"), li:has-text("${sub}") a`);
  if (found) { await found.click(); await page.waitForTimeout(2000); await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); break; }
}
await shot('sales-orders', 'Sales orders list');
const salesData = await pageData('sales_orders');
console.log('  Title:', salesData.title, '| Headers:', salesData.tableHeaders.slice(0,8).join(', '));

// Shipping
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
await page.waitForTimeout(500);
await clickSidebarItem('Sales');
await page.waitForTimeout(800);
for (const sub of ['Shipping', 'Shipments', 'Ship', 'Dispatch', 'Fulfillment']) {
  const found = await page.$(`a:has-text("${sub}"), li:has-text("${sub}") a`);
  if (found) { await found.click(); await page.waitForTimeout(2000); await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); break; }
}
await shot('shipping', 'Shipping / fulfillment');
const shipData = await pageData('shipping');
console.log('  Title:', shipData.title, '| Inputs:', shipData.inputs.slice(0,5).map(i=>i.label||i.name||i.id).join(', '));

// ── Quality ───────────────────────────────────────────────────────────────
console.log('\n🔍 Quality menu');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
await page.waitForTimeout(500);
await clickSidebarItem('Quality');
await page.waitForTimeout(1000);
await shot('quality-menu', 'Quality menu expanded');
const qualityData = await pageData('quality');
console.log('  Text sample:', qualityData.text.slice(0, 200));

// ── MRP ───────────────────────────────────────────────────────────────────
console.log('\n🔍 MRP menu');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
await page.waitForTimeout(500);
await clickSidebarItem('MRP');
await page.waitForTimeout(1000);
await shot('mrp-menu', 'MRP menu expanded');

// Inventory / Cycle Count under MRP or Items
for (const sub of ['Inventory', 'On Hand', 'Cycle Count', 'Inventory Count']) {
  const found = await page.$(`a:has-text("${sub}"), li:has-text("${sub}") a`);
  if (found) { await found.click(); await page.waitForTimeout(2000); await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); break; }
}
await shot('inventory', 'Inventory / On Hand / Cycle Count');
const invData = await pageData('inventory');
console.log('  Title:', invData.title, '| Headers:', invData.tableHeaders.slice(0,8).join(', '));

// ── Labels (likely under Items or Manufacturing) ───────────────────────────
console.log('\n🔍 Looking for Labels');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
await page.waitForTimeout(500);
for (const parent of ['Items', 'Manufacturing', 'Sales']) {
  await clickSidebarItem(parent);
  await page.waitForTimeout(800);
  for (const sub of ['Labels', 'Label', 'Print Labels', 'Label Printing']) {
    const found = await page.$(`a:has-text("${sub}"), li:has-text("${sub}") a`);
    if (found) {
      await found.click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      const d = await pageData('labels');
      if (d.title !== 'Dashboard | Masterplan ERP') {
        await shot('labels', 'Labels page');
        console.log('  Labels found under:', parent, '| Title:', d.title);
        break;
      }
    }
  }
  if (notes['labels']?.title && notes['labels'].title !== 'Dashboard | Masterplan ERP') break;
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
  await page.waitForTimeout(500);
}
if (!notes['labels'] || notes['labels'].title === 'Dashboard | Masterplan ERP') {
  await shot('labels', 'Labels — location unknown');
  console.log('  ⚠ Labels not found in standard nav locations');
}

// ── Capture full expanded nav of each top-level section ──────────────────
console.log('\n🔍 Capturing full nav structure for each section');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 });
await page.waitForTimeout(500);

const topLevelItems = ['Sales', 'Purchasing', 'Manufacturing', 'Items', 'MRP', 'Quality', 'PLM', 'Maintenance', 'Financials', 'Receivables', 'Payables', 'Employees'];
const fullNav = {};

for (const item of topLevelItems) {
  try {
    await clickSidebarItem(item);
    await page.waitForTimeout(800);
    const subItems = await page.evaluate((parent) => {
      const allLinks = Array.from(document.querySelectorAll('li a, nav a, .sidebar a, [class*="nav"] a'));
      return allLinks.map(a => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href'),
      })).filter(a => a.text && a.text !== parent);
    }, item);
    fullNav[item] = subItems.slice(0, 20);
    console.log(`  ${item}: ${subItems.slice(0,10).map(s=>s.text).join(', ')}`);
    // Screenshot each expanded menu
    await shot(`nav-${item.toLowerCase().replace(/\s+/g,'-')}`, `${item} menu fully expanded`);
  } catch (e) {
    console.log(`  ⚠ ${item}: ${e.message}`);
  }
}
notes['full_nav_structure'] = fullNav;

writeFileSync('./inspection-report.json', JSON.stringify(notes, null, 2));
console.log(`\n📄 Report saved. ${idx} screenshots.`);
console.log('✅ Deep inspection complete!');
await browser.close();
