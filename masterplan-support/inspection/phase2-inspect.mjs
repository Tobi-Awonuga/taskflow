/**
 * Phase 2 — Enter 2FA code, then inspect all Masterplan modules.
 * Usage: OTP=110630 node phase2-inspect.mjs
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.MASTERPLAN_BASE_URL ?? 'https://preview.masterplansolutions.com/';
const OTP      = process.env.OTP;

if (!OTP) { console.error('ERROR: OTP env var required.'); process.exit(1); }

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
  storageState: './session.json',
});

const page = await context.newPage();
const notes = {};
let shotIdx = 0;

async function shot(name, note = '') {
  shotIdx++;
  const file = join('screenshots', `${String(shotIdx).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${file}${note ? ' — '+note : ''}`);
  notes[name] = { file, url: page.url(), note, ts: new Date().toISOString() };
  return file;
}

async function pageInfo() {
  return page.evaluate(() => ({
    text: document.body.innerText.slice(0, 3000),
    links: Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim().slice(0,60), href: a.href }))
      .filter(a => a.text).slice(0, 80),
    inputs: Array.from(document.querySelectorAll('input,select,textarea'))
      .map(el => ({
        tag: el.tagName, type: el.type, name: el.name, id: el.id,
        placeholder: el.placeholder, required: el.required,
        label: (document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ?? ''),
      }))
      .filter(f => f.name || f.id || f.placeholder),
    buttons: Array.from(document.querySelectorAll('button,input[type="button"],input[type="submit"],a.btn'))
      .map(b => b.textContent.trim() || b.value).filter(Boolean).slice(0, 30),
    title: document.title,
    h1: Array.from(document.querySelectorAll('h1,h2')).map(h => h.textContent.trim()).slice(0,5),
  }));
}

async function tryNav(selectors, label) {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1500);
        console.log(`  ✓ Navigated via: ${sel}`);
        return true;
      }
    } catch {}
  }
  console.log(`  ⚠ Could not navigate: ${label}`);
  return false;
}

// ── Step 1: Resume session on 2FA code entry page ─────────────────────────
console.log('\n=== Phase 2: Masterplan Full Inspection ===\n');
console.log('Resuming session…');

await page.goto(BASE_URL + 'SignIn/Account/SendCode', { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1000);
await shot('00-resumed-session', 'Session resumed — checking where we are');

const startUrl = page.url();
console.log('Current URL:', startUrl);

// If still on SendCode page, submit to get to code entry
if (startUrl.includes('SendCode')) {
  console.log('Submitting to trigger code send…');
  await page.click('input[type="submit"], button[type="submit"]').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot('01-after-send', 'After triggering code send');
}

// ── Step 2: Enter the OTP ─────────────────────────────────────────────────
console.log(`Entering OTP: ${OTP}`);
const otpSelectors = [
  'input[name="Code"]', 'input[name="code"]', '#Code', '#code',
  'input[type="text"]', 'input[type="number"]', 'input[autocomplete="one-time-code"]',
];

let otpFilled = false;
for (const sel of otpSelectors) {
  try {
    const el = await page.$(sel);
    if (el) {
      await el.fill(OTP);
      console.log(`  Filled OTP using: ${sel}`);
      otpFilled = true;
      break;
    }
  } catch {}
}

if (!otpFilled) {
  await shot('error-no-otp-field', 'Could not find OTP input field');
  const info = await pageInfo();
  console.log('Page text:', info.text.slice(0,500));
  console.log('Inputs:', info.inputs);
}

await shot('02-otp-entered', 'OTP entered');

// Submit
const submitSelectors = ['input[type="submit"]','button[type="submit"]','button:has-text("Verify")','button:has-text("Submit")','#submitBtn'];
for (const sel of submitSelectors) {
  try {
    const el = await page.$(sel);
    if (el) { await el.click(); console.log(`  Submitted via: ${sel}`); break; }
  } catch {}
}

await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2000);

const postOtpUrl = page.url();
console.log('URL after OTP submit:', postOtpUrl);
await shot('03-post-otp', 'After OTP submission');

const postOtpInfo = await pageInfo();
const loggedIn = !postOtpUrl.includes('SignIn') && !postOtpUrl.includes('SendCode') && !postOtpUrl.includes('VerifyCode');

if (!loggedIn) {
  console.log('\n⚠ OTP may have been rejected or expired.');
  console.log('Page text:', postOtpInfo.text.slice(0, 400));
  notes['login_result'] = { success: false, url: postOtpUrl, text: postOtpInfo.text.slice(0,400) };
  writeFileSync('./inspection-report.json', JSON.stringify(notes, null, 2));
  await browser.close();
  process.exit(0);
}

console.log('\n✅ LOGGED IN SUCCESSFULLY!');
notes['login_result'] = { success: true, url: postOtpUrl };

// ── Step 3: Home / Dashboard ──────────────────────────────────────────────
console.log('\n🔍 Dashboard / Home');
const homeInfo = await pageInfo();
notes['dashboard'] = { url: postOtpUrl, title: homeInfo.title, h1: homeInfo.h1, text: homeInfo.text, links: homeInfo.links, buttons: homeInfo.buttons };
await shot('04-dashboard', 'Main dashboard after login');

// ── Step 4: Navigate all top-level menu items ─────────────────────────────
console.log('\n🔍 Capturing full navigation menu');
const navLinks = await page.evaluate(() =>
  Array.from(document.querySelectorAll('nav a, .navbar a, .sidebar a, .menu a, [role="navigation"] a, .nav-item a'))
    .map(a => ({ text: a.textContent.trim(), href: a.href }))
    .filter(a => a.text && a.href && !a.href.endsWith('#'))
    .slice(0, 60)
);
console.log('Nav links found:', navLinks.length);
notes['nav_links'] = navLinks;
await shot('05-nav-overview', 'Full navigation visible');

// ── Step 5: Item Master ───────────────────────────────────────────────────
console.log('\n🔍 Item Master');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
const itemNaved = await tryNav([
  'a:has-text("Items")', 'a:has-text("Item Master")', 'a:has-text("Products")',
  'a[href*="item" i]', 'a[href*="product" i]', 'a[href*="catalog" i]',
], 'Item Master');

if (!itemNaved) {
  // Try direct URL patterns
  for (const path of ['Items','ItemMaster','Inventory/Items','Products','Catalog']) {
    try {
      await page.goto(BASE_URL + path, { waitUntil: 'networkidle', timeout: 8000 });
      if (!page.url().includes('SignIn')) { console.log(`  ✓ Direct URL: ${path}`); break; }
    } catch {}
  }
}
const itemInfo = await pageInfo();
notes['item_master'] = { url: page.url(), title: itemInfo.title, h1: itemInfo.h1, text: itemInfo.text, links: itemInfo.links, inputs: itemInfo.inputs, buttons: itemInfo.buttons };
await shot('06-item-master', 'Item master list');

// ── Step 6: New Item form ─────────────────────────────────────────────────
console.log('\n🔍 New Item creation form');
await tryNav([
  'a:has-text("New Item")', 'a:has-text("Add Item")', 'a:has-text("Create Item")',
  'button:has-text("New")', 'button:has-text("Add")', 'button:has-text("Create")',
  'a:has-text("New")', '[href*="Create" i]', '[href*="new" i]', '.btn-primary',
], 'New Item button');
const newItemInfo = await pageInfo();
notes['new_item_form'] = { url: page.url(), title: newItemInfo.title, h1: newItemInfo.h1, text: newItemInfo.text, inputs: newItemInfo.inputs, buttons: newItemInfo.buttons };
await shot('07-new-item-form', 'New item creation form — fields and required inputs');

// ── Step 7: Purchase Orders ───────────────────────────────────────────────
console.log('\n🔍 Purchase Orders');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await tryNav([
  'a:has-text("Purchase Order")', 'a:has-text("Purchasing")', 'a:has-text("Purchase")',
  'a[href*="PurchaseOrder" i]', 'a[href*="purchase" i]', 'a[href*="po" i]',
], 'Purchase Orders');
const poInfo = await pageInfo();
notes['purchase_orders'] = { url: page.url(), title: poInfo.title, h1: poInfo.h1, text: poInfo.text, links: poInfo.links, buttons: poInfo.buttons };
await shot('08-purchase-orders', 'Purchase order list');

// ── Step 8: PO Receiving ──────────────────────────────────────────────────
console.log('\n🔍 PO Receiving');
await tryNav([
  'a:has-text("Receiving")', 'a:has-text("Receive")', 'a:has-text("Receipt")',
  'a[href*="receiv" i]', 'a[href*="receipt" i]',
], 'PO Receiving');
const receivingInfo = await pageInfo();
notes['po_receiving'] = { url: page.url(), title: receivingInfo.title, h1: receivingInfo.h1, text: receivingInfo.text, inputs: receivingInfo.inputs, buttons: receivingInfo.buttons };
await shot('09-po-receiving', 'PO receiving screen');

// ── Step 9: Transfer Orders ───────────────────────────────────────────────
console.log('\n🔍 Transfer Orders');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await tryNav([
  'a:has-text("Transfer")', 'a:has-text("Transfers")', 'a:has-text("Transfer Order")',
  'a[href*="transfer" i]', 'a[href*="TransferOrder" i]',
], 'Transfer Orders');
const transferInfo = await pageInfo();
notes['transfer_orders'] = { url: page.url(), title: transferInfo.title, h1: transferInfo.h1, text: transferInfo.text, links: transferInfo.links, buttons: transferInfo.buttons };
await shot('10-transfer-orders', 'Transfer orders');

// ── Step 10: Production Orders ────────────────────────────────────────────
console.log('\n🔍 Production Orders');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await tryNav([
  'a:has-text("Production")', 'a:has-text("Manufacturing")', 'a:has-text("Work Order")',
  'a[href*="production" i]', 'a[href*="manufacturing" i]', 'a[href*="workorder" i]',
], 'Production Orders');
const prodInfo = await pageInfo();
notes['production_orders'] = { url: page.url(), title: prodInfo.title, h1: prodInfo.h1, text: prodInfo.text, links: prodInfo.links, buttons: prodInfo.buttons };
await shot('11-production-orders', 'Production orders');

// ── Step 11: Inventory ────────────────────────────────────────────────────
console.log('\n🔍 Inventory');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await tryNav([
  'a:has-text("Inventory")', 'a:has-text("Stock")', 'a:has-text("On Hand")',
  'a[href*="inventory" i]', 'a[href*="stock" i]',
], 'Inventory');
const invInfo = await pageInfo();
notes['inventory'] = { url: page.url(), title: invInfo.title, h1: invInfo.h1, text: invInfo.text, links: invInfo.links, buttons: invInfo.buttons };
await shot('12-inventory', 'Inventory view');

// ── Step 12: Sales / Shipping Orders ─────────────────────────────────────
console.log('\n🔍 Sales / Shipping Orders');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await tryNav([
  'a:has-text("Sales Order")', 'a:has-text("Sales")', 'a:has-text("Shipping")', 'a:has-text("Shipment")',
  'a[href*="sales" i]', 'a[href*="shipping" i]', 'a[href*="shipment" i]',
], 'Sales/Shipping');
const salesInfo = await pageInfo();
notes['sales_shipping'] = { url: page.url(), title: salesInfo.title, h1: salesInfo.h1, text: salesInfo.text, links: salesInfo.links, buttons: salesInfo.buttons };
await shot('13-sales-shipping', 'Sales and shipping orders');

// ── Step 13: Labels ───────────────────────────────────────────────────────
console.log('\n🔍 Labels');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await tryNav([
  'a:has-text("Label")', 'a:has-text("Labels")', 'a:has-text("Print Label")',
  'a[href*="label" i]',
], 'Labels');
const labelInfo = await pageInfo();
notes['labels'] = { url: page.url(), title: labelInfo.title, h1: labelInfo.h1, text: labelInfo.text, links: labelInfo.links, buttons: labelInfo.buttons };
await shot('14-labels', 'Label management');

// ── Step 14: User / Permissions settings ─────────────────────────────────
console.log('\n🔍 User / Admin settings');
await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await tryNav([
  'a:has-text("Admin")', 'a:has-text("Settings")', 'a:has-text("Users")',
  'a:has-text("Permissions")', 'a[href*="admin" i]', 'a[href*="setting" i]',
], 'Admin/Settings');
const adminInfo = await pageInfo();
notes['admin_settings'] = { url: page.url(), title: adminInfo.title, h1: adminInfo.h1, text: adminInfo.text, links: adminInfo.links, buttons: adminInfo.buttons };
await shot('15-admin-settings', 'Admin / user / permissions settings');

// ── Save report ───────────────────────────────────────────────────────────
writeFileSync('./inspection-report.json', JSON.stringify(notes, null, 2));
console.log('\n📄 Report saved: inspection-report.json');
console.log(`📸 ${shotIdx} screenshots in ./screenshots/`);
console.log('\n✅ Inspection complete!');

await browser.close();
