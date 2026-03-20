/**
 * Targeted reconnaissance: Item Creation DOM signals
 * Sandbox: https://no1.masterplansolutions.com/
 *
 * Discovers:
 *  1. Save button selector on New Item form
 *  2. Key field selectors on New Item form
 *  3. Copy to New Item modal selectors (heading, inputs, save button)
 *  4. Whether tab switching re-renders the Save button
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const BASE_URL = process.env.MASTERPLAN_BASE_URL ?? 'https://no1.masterplansolutions.com/';
const USERNAME = process.env.MASTERPLAN_USERNAME;
const PASSWORD = process.env.MASTERPLAN_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('Set MASTERPLAN_USERNAME and MASTERPLAN_PASSWORD');
  process.exit(1);
}

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
const page = await context.newPage();

// ── AUTH ────────────────────────────────────────────────────────────────────
console.log('🔐 Logging in to', BASE_URL);
await page.goto(BASE_URL + 'SignIn/', { waitUntil: 'networkidle', timeout: 30000 });
await page.fill('#Email', USERNAME);
await page.fill('input[type="password"]', PASSWORD);
await page.click('input[type="submit"]');

// Wait for SendCode page
await page.waitForURL('**/SendCode**', { timeout: 20000 }).catch(() => {});
console.log('   At SendCode:', page.url());

// Try selecting Email and submitting
try {
  const sel = page.locator('select');
  if (await sel.count() > 0) {
    await sel.selectOption({ label: /email/i });
  }
} catch {}
await page.click('input[type="submit"], button[type="submit"]');
await page.waitForURL('**/VerifyCode**', { timeout: 10000 }).catch(() => {});
console.log('   At VerifyCode:', page.url());

// Prompt for OTP
const otp = process.env.MASTERPLAN_OTP;
if (!otp) {
  console.log('\n⚠️  Set MASTERPLAN_OTP=<code> and re-run.');
  await browser.close();
  process.exit(1);
}

await page.fill('input[autocomplete="one-time-code"], input[type="text"]', otp);
await page.click('input[type="submit"], button[type="submit"]');
await page.waitForURL('**/', { timeout: 20000 }).catch(() => {});

if (page.url().includes('SignIn')) {
  console.error('❌ Login failed — check credentials or OTP');
  await page.screenshot({ path: 'screenshots/recon-login-fail.png' });
  await browser.close();
  process.exit(1);
}
console.log('✅ Logged in. At:', page.url());

// ── HELPER ──────────────────────────────────────────────────────────────────
async function dumpDOM(label) {
  return page.evaluate((lbl) => {
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')).map(el => ({
      tag: el.tagName,
      type: el.type ?? '',
      id: el.id,
      name: el.name ?? '',
      value: el.value ?? '',
      text: el.textContent?.trim() ?? '',
      class: el.className ?? '',
      disabled: el.disabled,
    }));

    const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input:not([type]), select, textarea')).map(el => ({
      tag: el.tagName,
      type: el.type ?? '',
      id: el.id,
      name: el.name ?? '',
      placeholder: el.placeholder ?? '',
      value: el.value ?? '',
      label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ?? '',
      class: el.className ?? '',
    }));

    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,.modal-title,[class*="title"],[class*="header"],[class*="heading"]')).map(el => ({
      tag: el.tagName,
      id: el.id,
      class: el.className,
      text: el.textContent?.trim().slice(0, 100),
    }));

    const modals = Array.from(document.querySelectorAll('[class*="modal"],[class*="dialog"],[role="dialog"],[id*="modal"],[id*="dialog"]')).map(el => ({
      tag: el.tagName,
      id: el.id,
      class: el.className,
      visible: el.offsetParent !== null,
      text: el.textContent?.trim().slice(0, 200),
    }));

    return { label: lbl, url: window.location.href, buttons, inputs, headings, modals };
  }, label);
}

const results = {};

// ── 1. NEW ITEM FORM ─────────────────────────────────────────────────────────
console.log('\n🔍 [1] Navigating to Item List → clicking New Item');
await page.goto(BASE_URL + 'items_itemlist', { waitUntil: 'networkidle', timeout: 20000 });
await page.screenshot({ path: 'screenshots/recon-01-item-list.png' });
console.log('   Item List URL:', page.url());

// Click New Item button
try {
  await page.click('text="New Item"', { timeout: 5000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
} catch (e) {
  console.log('   ⚠ Could not click "New Item":', e.message);
  // Try other selectors
  const btn = await page.$('input[value*="New Item"], button:has-text("New Item"), a:has-text("New Item")');
  if (btn) { await btn.click(); await page.waitForTimeout(2000); }
}

const newItemUrl = page.url();
console.log('   New Item URL:', newItemUrl);
await page.screenshot({ path: 'screenshots/recon-02-new-item-form.png', fullPage: true });
results['new_item_form'] = await dumpDOM('new_item_form');
results['new_item_form'].url = newItemUrl;

console.log('   Buttons found:');
results['new_item_form'].buttons.forEach(b => console.log(`     [${b.tag}] id="${b.id}" value="${b.value}" text="${b.text}" disabled=${b.disabled}`));
console.log('   Key inputs:');
results['new_item_form'].inputs.slice(0, 15).forEach(i => console.log(`     [${i.tag}] id="${i.id}" name="${i.name}" label="${i.label}" placeholder="${i.placeholder}"`));

// ── 2. TAB SWITCH TEST (does Save button persist?) ───────────────────────────
console.log('\n🔍 [2] Testing tab switch — does Save button persist?');
const saveBeforeTab = await page.$('input[value*="Save"], button:has-text("Save")');
const saveBeforeId = saveBeforeTab ? await saveBeforeTab.getAttribute('id') : 'not found';
console.log('   Save button before tab switch:', saveBeforeId);

// Click Inventory tab
try {
  await page.click('text="Inventory"', { timeout: 3000 });
  await page.waitForTimeout(1000);
  const saveAfterTab = await page.$('input[value*="Save"], button:has-text("Save")');
  const saveAfterId = saveAfterTab ? await saveAfterTab.getAttribute('id') : 'not found';
  console.log('   Save button after Inventory tab:', saveAfterId);
  results['tab_switch_test'] = { before: saveBeforeId, after: saveAfterId, same: saveBeforeId === saveAfterId };

  // Click back to Item Info
  await page.click('text="Item Info"', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
} catch (e) {
  console.log('   ⚠ Tab switch test failed:', e.message);
  results['tab_switch_test'] = { error: e.message };
}

// ── 3. EXISTING ITEM → COPY TO NEW ITEM MODAL ────────────────────────────────
console.log('\n🔍 [3] Opening existing item (ItemMasterID=2) → Copy to New Item');
await page.goto(BASE_URL + 'frmITEMS_ItemMaster.aspx?ItemMasterID=2&NewUI=TRUE', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/recon-03-existing-item.png', fullPage: true });
console.log('   Existing item URL:', page.url());

// Find and click the action menu (the "..." or dropdown that contains "Copy to New Item")
// From screenshots it appears to be a button that expands a menu
let copyClicked = false;
const menuSelectors = [
  'text="Copy to New Item"',
  '[title*="Copy"]',
  'button:has-text("Copy")',
  'a:has-text("Copy to New Item")',
];

// First try to find the action/overflow menu button
const menuBtnSelectors = [
  'text="..."',
  'button[title="More"]',
  '[class*="action-menu"]',
  '[class*="dropdown"] button',
  'button:has-text("Actions")',
];

for (const sel of menuBtnSelectors) {
  try {
    const el = await page.$(sel);
    if (el) {
      console.log('   Found menu trigger:', sel);
      await el.click();
      await page.waitForTimeout(800);
      break;
    }
  } catch {}
}

await page.screenshot({ path: 'screenshots/recon-04-action-menu-open.png' });

for (const sel of menuSelectors) {
  try {
    const el = await page.$(sel);
    if (el) {
      console.log('   Found "Copy to New Item" with selector:', sel);
      await el.click();
      await page.waitForTimeout(1500);
      copyClicked = true;
      break;
    }
  } catch {}
}

if (!copyClicked) {
  console.log('   ⚠ Could not click Copy to New Item. Trying all visible text on page...');
  const allText = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a,button,li,span,div')).filter(el => el.offsetParent !== null && el.textContent?.trim()).map(el => ({ tag: el.tagName, id: el.id, class: el.className, text: el.textContent?.trim().slice(0,60) })).filter(el => el.text.length > 0 && el.text.length < 60)
  );
  results['all_clickable_elements'] = allText;
  console.log('   Visible clickable elements:', JSON.stringify(allText.slice(0, 30), null, 2));
}

await page.screenshot({ path: 'screenshots/recon-05-copy-modal.png', fullPage: true });
const copyModalData = await dumpDOM('copy_modal');
results['copy_modal'] = copyModalData;

console.log('   Modals/dialogs found:');
copyModalData.modals.forEach(m => console.log(`     [${m.tag}] id="${m.id}" class="${m.class}" visible=${m.visible} text="${m.text?.slice(0,100)}"`));
console.log('   Headings found:');
copyModalData.headings.forEach(h => console.log(`     [${h.tag}] id="${h.id}" class="${h.class}" text="${h.text}"`));
console.log('   Inputs in modal context:');
copyModalData.inputs.slice(0, 12).forEach(i => console.log(`     [${i.tag}] id="${i.id}" name="${i.name}" label="${i.label}" value="${i.value}"`));
console.log('   Buttons:');
copyModalData.buttons.forEach(b => console.log(`     [${b.tag}] id="${b.id}" value="${b.value}" text="${b.text}"`));

// ── 4. URL PARAM ANALYSIS ────────────────────────────────────────────────────
console.log('\n🔍 [4] URL param analysis');
const urlAfterCopy = page.url();
console.log('   URL after clicking Copy to New Item:', urlAfterCopy);
results['url_after_copy_click'] = urlAfterCopy;

const urlParams = (url) => Object.fromEntries(new URL(url).searchParams);
console.log('   New Item URL params:', urlParams(newItemUrl.startsWith('http') ? newItemUrl : BASE_URL + newItemUrl));
results['new_item_url_params'] = newItemUrl;
results['copy_modal_url'] = urlAfterCopy;

// ── SAVE RESULTS ─────────────────────────────────────────────────────────────
writeFileSync('./recon-results.json', JSON.stringify(results, null, 2));
console.log('\n📄 Full results saved to recon-results.json');
console.log('✅ Reconnaissance complete');
await browser.close();
