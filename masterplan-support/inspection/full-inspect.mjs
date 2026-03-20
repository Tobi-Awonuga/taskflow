/**
 * Full inspection — login, 2FA, then inspect all modules in one session.
 * Usage: OTP=XXXXXX node full-inspect.mjs
 *
 * Run without OTP first to trigger the code email, then re-run with OTP set.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.MASTERPLAN_BASE_URL ?? 'https://preview.masterplansolutions.com/';
const USERNAME = process.env.MASTERPLAN_USERNAME;
const PASSWORD = process.env.MASTERPLAN_PASSWORD;
const OTP      = process.env.OTP; // set when re-running after receiving code

if (!USERNAME || !PASSWORD) { console.error('Need MASTERPLAN_USERNAME + MASTERPLAN_PASSWORD'); process.exit(1); }

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

const context = await browser.newContext({ ignoreHTTPSErrors: true, proxy: proxyConfig, viewport: { width: 1440, height: 900 } });
const page    = await context.newPage();
const notes   = {};
let idx = 0;

async function shot(name, note = '') {
  const file = join('screenshots', `${String(++idx).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${file}${note ? ' — '+note : ''}`);
  notes[name] = { file, url: page.url(), note };
  return file;
}

async function info() {
  return page.evaluate(() => ({
    title: document.title,
    h1: Array.from(document.querySelectorAll('h1,h2,h3')).map(h=>h.textContent.trim()).filter(Boolean).slice(0,6),
    text: document.body.innerText.slice(0, 4000),
    links: Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim().slice(0,60), href: a.href }))
      .filter(a => a.text).slice(0, 80),
    inputs: Array.from(document.querySelectorAll('input,select,textarea'))
      .map(el => ({
        tag: el.tagName, type: el.type, name: el.name, id: el.id,
        placeholder: el.placeholder, required: el.required,
        label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ?? '',
        value: el.type === 'password' ? '***' : el.value,
      })).filter(f => f.name || f.id || f.placeholder),
    buttons: Array.from(document.querySelectorAll('button,input[type=submit],input[type=button]'))
      .map(b => (b.textContent||b.value||'').trim()).filter(Boolean).slice(0,20),
  }));
}

async function go(paths, label) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 12000 }).catch(()=>{});
  for (const sel of paths) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(()=>{});
        await page.waitForTimeout(1200);
        if (!page.url().includes('SignIn')) { console.log(`  ✓ ${label} via: ${sel}`); return true; }
      }
    } catch {}
  }
  // Try direct URL guesses
  for (const p of guessUrls(label)) {
    try {
      await page.goto(BASE_URL + p, { waitUntil: 'networkidle', timeout: 8000 });
      if (!page.url().includes('SignIn')) { console.log(`  ✓ ${label} via URL: ${p}`); return true; }
    } catch {}
  }
  console.log(`  ⚠ Could not reach: ${label}`);
  return false;
}

function guessUrls(label) {
  const map = {
    'Item Master': ['Items','ItemMaster','Inventory/Items','Products'],
    'PO List':     ['PurchaseOrders','Purchasing/PurchaseOrders','Purchasing'],
    'Receiving':   ['Receiving','PurchaseOrders/Receiving','Purchasing/Receiving'],
    'Transfers':   ['TransferOrders','Inventory/TransferOrders','Transfers'],
    'Production':  ['ProductionOrders','Manufacturing','WorkOrders'],
    'Inventory':   ['Inventory','OnHand','Stock'],
    'Sales':       ['SalesOrders','Sales','Orders'],
    'Shipping':    ['Shipping','Shipments','Dispatch'],
    'Labels':      ['Labels','LabelPrinting','Print/Labels'],
    'Admin':       ['Admin','Administration','Settings','Users'],
  };
  return map[label] ?? [];
}

// ── LOGIN ─────────────────────────────────────────────────────────────────
console.log('\n=== Masterplan Full Inspection ===\n');
console.log('Step 1: Login');
await page.goto(BASE_URL + 'SignIn/', { waitUntil: 'networkidle', timeout: 25000 });
await shot('login-page', 'Login form');

await page.fill('#Email', USERNAME);
await page.fill('input[type="password"]', PASSWORD);
await page.click('input[type="submit"]');
await page.waitForURL('**SendCode**', { timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(1000);

if (!page.url().includes('SendCode')) {
  const i = await info();
  console.log('Unexpected URL after login:', page.url());
  console.log('Page text:', i.text.slice(0,300));
  await shot('login-failed');
  await browser.close(); process.exit(1);
}

console.log('✓ Credentials accepted — at 2FA page');
await shot('mfa-page', '2FA provider selection');

// Submit to send the email code
await page.selectOption('select', 'Email').catch(()=>{});
await page.click('input[type="submit"], button[type="submit"]');
await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(()=>{});
await page.waitForTimeout(1500);
await shot('code-sent', 'After requesting email code');

const afterSendUrl = page.url();
console.log('URL after sending code:', afterSendUrl);
const afterSendInfo = await info();
console.log('Page:', afterSendInfo.title, '|', afterSendInfo.h1.join(', '));
console.log('Inputs:', afterSendInfo.inputs.map(i => `${i.tag}[${i.name||i.id||i.type}]`).join(', '));

if (!OTP) {
  console.log('\n📧 Code email triggered. Now re-run with OTP=<your-code> to continue.');
  await browser.close();
  process.exit(0);
}

// ── ENTER OTP ─────────────────────────────────────────────────────────────
console.log(`\nStep 2: Entering OTP: ${OTP}`);
const otpField = await page.$('input[name="Code"],input[name="code"],#Code,#code,input[type="text"],input[autocomplete="one-time-code"]');
if (!otpField) {
  console.log('⚠ OTP field not found. Page inputs:', afterSendInfo.inputs);
  await shot('otp-field-missing');
  await browser.close(); process.exit(1);
}
await otpField.fill(OTP);
await shot('otp-filled', 'OTP entered');

await page.click('input[type="submit"],button[type="submit"],button:has-text("Verify"),button:has-text("Submit")');
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(()=>{});
await page.waitForTimeout(2000);

const postOtpUrl = page.url();
console.log('URL after OTP:', postOtpUrl);

if (postOtpUrl.includes('SignIn') || postOtpUrl.includes('VerifyCode')) {
  const i = await info();
  console.log('⚠ Still on auth page. OTP may be wrong/expired.');
  console.log('Text:', i.text.slice(0,300));
  await shot('otp-failed');
  await browser.close(); process.exit(1);
}

console.log('\n✅ LOGGED IN!');
await shot('logged-in-home', 'Home after login');
const homeInfo = await info();
notes['home'] = { url: postOtpUrl, ...homeInfo };
console.log('Dashboard title:', homeInfo.title);
console.log('Nav links:', homeInfo.links.slice(0,15).map(l=>l.text).join(' | '));

// Save cookies for potential reuse
await context.storageState({ path: './session-authed.json' });

// ── INSPECT EACH MODULE ───────────────────────────────────────────────────

async function inspect(key, label, navSelectors) {
  console.log(`\n🔍 ${label}`);
  await go(navSelectors, label);
  const i = await info();
  notes[key] = { url: page.url(), title: i.title, h1: i.h1, text: i.text, links: i.links, inputs: i.inputs, buttons: i.buttons };
  await shot(key, label);
  console.log(`  Title: ${i.title} | H1: ${i.h1[0]||'—'}`);
  console.log(`  Inputs: ${i.inputs.length} | Buttons: ${i.buttons.slice(0,8).join(', ')}`);
}

await inspect('item_master', 'Item Master', [
  'a:has-text("Items")', 'a:has-text("Item Master")', 'a:has-text("Products")',
  'nav a[href*="item" i]', 'nav a[href*="product" i]',
]);

await inspect('new_item', 'New Item Form', [
  'a:has-text("New Item")', 'a:has-text("Add Item")', 'button:has-text("New")',
  'a:has-text("New")', '.btn-primary', 'a:has-text("Create")',
]);

await inspect('purchase_orders', 'Purchase Orders', [
  'a:has-text("Purchase Order")', 'a:has-text("Purchasing")',
  'nav a[href*="purchase" i]', 'nav a[href*="po" i]',
]);

await inspect('receiving', 'PO Receiving', [
  'a:has-text("Receiving")', 'a:has-text("Receive")',
  'a[href*="receiv" i]',
]);

await inspect('transfer_orders', 'Transfer Orders', [
  'a:has-text("Transfer Order")', 'a:has-text("Transfers")',
  'nav a[href*="transfer" i]',
]);

await inspect('production_orders', 'Production Orders', [
  'a:has-text("Production")', 'a:has-text("Work Order")', 'a:has-text("Manufacturing")',
  'nav a[href*="production" i]', 'nav a[href*="workorder" i]',
]);

await inspect('inventory', 'Inventory / On Hand', [
  'a:has-text("Inventory")', 'a:has-text("On Hand")', 'a:has-text("Stock")',
  'nav a[href*="inventory" i]',
]);

await inspect('sales_orders', 'Sales Orders', [
  'a:has-text("Sales Order")', 'a:has-text("Sales")', 'a:has-text("Orders")',
  'nav a[href*="sales" i]', 'nav a[href*="order" i]',
]);

await inspect('shipping', 'Shipping', [
  'a:has-text("Shipping")', 'a:has-text("Shipment")', 'a:has-text("Dispatch")',
  'nav a[href*="ship" i]',
]);

await inspect('labels', 'Labels', [
  'a:has-text("Label")', 'a:has-text("Labels")', 'a:has-text("Print")',
  'nav a[href*="label" i]',
]);

await inspect('admin', 'Admin / Users / Settings', [
  'a:has-text("Admin")', 'a:has-text("Settings")', 'a:has-text("Users")',
  'a:has-text("Permissions")', 'nav a[href*="admin" i]', 'nav a[href*="setting" i]',
]);

writeFileSync('./inspection-report.json', JSON.stringify(notes, null, 2));
console.log(`\n📄 Report saved. ${idx} screenshots captured.`);
console.log('✅ Inspection complete!');
await browser.close();
