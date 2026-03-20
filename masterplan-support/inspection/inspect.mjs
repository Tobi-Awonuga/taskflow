/**
 * CT Bakery — Masterplan ERP Inspection Script
 *
 * READ-ONLY inspection. No data modification.
 * Credentials loaded from environment variables only.
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL    = process.env.MASTERPLAN_BASE_URL ?? 'https://preview.masterplansolutions.com/';
const USERNAME    = process.env.MASTERPLAN_USERNAME;
const PASSWORD    = process.env.MASTERPLAN_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('ERROR: MASTERPLAN_USERNAME and MASTERPLAN_PASSWORD must be set as env vars.');
  process.exit(1);
}

const SCREENSHOTS = './screenshots';
if (!existsSync(SCREENSHOTS)) mkdirSync(SCREENSHOTS, { recursive: true });

const notes = {};
let browser, page;

async function shot(name, note = '') {
  const file = join(SCREENSHOTS, `${String(Object.keys(notes).length + 1).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  notes[name] = { screenshot: file, note, url: page.url(), timestamp: new Date().toISOString() };
  console.log(`  📸 ${file}${note ? ' — ' + note : ''}`);
}

async function safeClick(selectors, description = '') {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        return true;
      }
    } catch {}
  }
  console.log(`  ⚠ Could not click: ${description || selectors.join(', ')}`);
  return false;
}

async function getPageText() {
  return page.evaluate(() => document.body.innerText.slice(0, 2000));
}

async function getLinks() {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim(), href: a.href }))
      .filter(a => a.text)
      .slice(0, 60)
  );
}

async function getInputFields() {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('input, select, textarea'))
      .map(el => ({
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        placeholder: el.placeholder,
        required: el.required,
        label: (() => {
          const label = document.querySelector(`label[for="${el.id}"]`);
          return label ? label.textContent.trim() : '';
        })(),
      }))
      .filter(f => f.name || f.id || f.placeholder)
  );
}

async function inspectArea(name, description, goFn) {
  console.log(`\n🔍 Inspecting: ${name}`);
  try {
    await goFn();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const text = await getPageText();
    const links = await getLinks();
    const fields = await getInputFields();

    await shot(name, description);

    notes[name] = {
      ...notes[name],
      description,
      url: page.url(),
      pageTextSample: text,
      links: links.slice(0, 30),
      forms: fields,
    };

    console.log(`  URL: ${page.url()}`);
    console.log(`  Links found: ${links.length}, Form fields: ${fields.length}`);
    return true;
  } catch (err) {
    console.log(`  ❌ Failed: ${err.message}`);
    await shot(`${name}-error`, `Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('===========================================');
  console.log(' CT Bakery — Masterplan ERP Inspection');
  console.log(' Mode: READ-ONLY observation');
  console.log('===========================================');
  console.log(`\nTarget URL: ${BASE_URL}`);
  console.log(`User: ${USERNAME}`);

  // Parse proxy from environment
  const rawProxy = process.env.HTTP_PROXY || process.env.http_proxy || '';
  let proxyConfig = undefined;
  if (rawProxy) {
    const proxyUrl = new URL(rawProxy);
    proxyConfig = {
      server: `http://${proxyUrl.hostname}:${proxyUrl.port}`,
      username: decodeURIComponent(proxyUrl.username),
      password: decodeURIComponent(proxyUrl.password),
    };
    console.log(`[Proxy] Using proxy at ${proxyUrl.hostname}:${proxyUrl.port}`);
  }

  browser = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors'],
    proxy: proxyConfig,
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    proxy: proxyConfig,
  });

  page = await context.newPage();

  // ── 1. Login page ──────────────────────────────────────────────────────────
  console.log('\n🔑 Step 1: Login');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await shot('01-login-page', 'Masterplan login page as presented to users');

  const loginPageText = await getPageText();
  const loginFields = await getInputFields();
  console.log(`  Login page fields: ${loginFields.map(f => f.name || f.id || f.type).join(', ')}`);

  // ── 2. Attempt login ───────────────────────────────────────────────────────
  console.log('\n🔑 Step 2: Attempting login with env credentials…');

  let loggedIn = false;

  // Try various common login field selectors
  const userSelectors = [
    'input[name="username"]', 'input[name="Username"]',
    'input[name="email"]', 'input[type="email"]',
    'input[name="UserName"]', '#username', '#UserName',
    '#Email', 'input[placeholder*="email" i]', 'input[placeholder*="user" i]',
  ];

  const passSelectors = [
    'input[type="password"]', 'input[name="password"]',
    'input[name="Password"]', '#password', '#Password',
  ];

  let userFilled = false;
  for (const sel of userSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.fill(USERNAME);
        console.log(`  Filled username using selector: ${sel}`);
        userFilled = true;
        break;
      }
    } catch {}
  }

  let passFilled = false;
  for (const sel of passSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.fill(PASSWORD);
        console.log(`  Filled password using selector: ${sel}`);
        passFilled = true;
        break;
      }
    } catch {}
  }

  if (!userFilled || !passFilled) {
    await shot('02-login-fields-not-found', 'Could not find expected login fields');
    console.log('\n⚠ BLOCKER: Could not locate login form fields.');
    console.log('  This may indicate:');
    console.log('  - SSO / OAuth redirect');
    console.log('  - CAPTCHA or bot protection');
    console.log('  - Different login flow than expected');
    console.log('  Screenshot saved for manual review.');
    notes['blocker'] = {
      type: 'login_fields_not_found',
      loginFields,
      loginPageText: loginPageText.slice(0, 500),
    };
  } else {
    // Submit
    const submitSelectors = [
      'button[type="submit"]', 'input[type="submit"]',
      'button:has-text("Log In")', 'button:has-text("Login")',
      'button:has-text("Sign In")', 'button:has-text("Submit")',
      '.btn-primary', '#loginButton', '#btnLogin',
    ];

    for (const sel of submitSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          console.log(`  Clicked submit using: ${sel}`);
          break;
        }
      } catch {}
    }

    // Wait for navigation
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 });
    } catch {
      await page.waitForTimeout(3000);
    }

    const afterLoginUrl = page.url();
    const afterLoginText = await getPageText();
    await shot('02-after-login', `After login attempt — URL: ${afterLoginUrl}`);

    // Check if login succeeded
    const failKeywords = ['incorrect', 'invalid', 'failed', 'error', 'wrong password', 'denied', 'unauthorized'];
    const failDetected = failKeywords.some(k => afterLoginText.toLowerCase().includes(k));

    // Check for MFA/CAPTCHA
    const mfaKeywords = ['two-factor', '2fa', 'mfa', 'verification code', 'authenticator', 'otp', 'captcha'];
    const mfaDetected = mfaKeywords.some(k => afterLoginText.toLowerCase().includes(k));

    if (mfaDetected) {
      console.log('\n⚠ BLOCKER: MFA / 2FA / CAPTCHA detected after login attempt.');
      notes['blocker'] = { type: 'mfa_or_captcha', pageText: afterLoginText.slice(0, 500) };
    } else if (failDetected) {
      console.log('\n⚠ Login failed — invalid credentials or other error.');
      notes['blocker'] = { type: 'login_failed', pageText: afterLoginText.slice(0, 500) };
    } else if (afterLoginUrl !== BASE_URL && !afterLoginUrl.includes('login')) {
      console.log('  ✅ Login appears successful!');
      loggedIn = true;
    } else {
      // Ambiguous — log and continue inspecting
      console.log('  ⚠ Login result unclear — continuing inspection…');
      loggedIn = afterLoginText.length > 100 && !failDetected;
    }
  }

  if (!loggedIn) {
    console.log('\n⚠ Could not confirm successful login. Taking current page screenshots for review.');
    await shot('03-login-state-unknown', 'Login state unclear');
    await saveReport();
    await browser.close();
    return;
  }

  // ── 3. Dashboard / Home ────────────────────────────────────────────────────
  await inspectArea('03-home-dashboard', 'Main dashboard/home after login', async () => {
    // Already there after login
  });

  // ── 4. Item Master / Item Creation ────────────────────────────────────────
  await inspectArea('04-item-master', 'Item master list — where items can be searched/created', async () => {
    const tried = await safeClick([
      'a:has-text("Items")', 'a:has-text("Item Master")', 'a:has-text("Inventory")',
      '[data-module="inventory"]', 'a[href*="item"]', 'a[href*="Item"]',
    ], 'Item master navigation');

    if (!tried) {
      await page.goto(BASE_URL + 'items', { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    }
  });

  // ── 5. New Item form ───────────────────────────────────────────────────────
  await inspectArea('05-new-item-form', 'New item creation form — fields required, controls present', async () => {
    await safeClick([
      'a:has-text("New Item")', 'a:has-text("Create Item")', 'a:has-text("Add Item")',
      'button:has-text("New")', 'button:has-text("Create")', 'button:has-text("Add")',
      '[href*="new"]', '[href*="create"]', '.btn-new', '#btnNew',
    ], 'New item button');
  });

  // ── 6. Purchase Orders ─────────────────────────────────────────────────────
  await inspectArea('06-purchase-orders', 'Purchase order list and receiving workflow', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await safeClick([
      'a:has-text("Purchase")', 'a:has-text("Purchasing")', 'a:has-text("PO")',
      '[data-module="purchasing"]', 'a[href*="purchase"]', 'a[href*="PurchaseOrder"]',
    ], 'Purchasing navigation');
  });

  // ── 7. Receiving ───────────────────────────────────────────────────────────
  await inspectArea('07-receiving', 'PO receiving screen — what QA/warehouse sees', async () => {
    await safeClick([
      'a:has-text("Receiving")', 'a:has-text("Receive")', 'a:has-text("PO Receiving")',
      'a[href*="receiv"]', 'a[href*="Receiv"]',
    ], 'Receiving navigation');
  });

  // ── 8. Inventory / Transfer Orders ────────────────────────────────────────
  await inspectArea('08-transfer-orders', 'Transfer orders for raw materials and finished goods', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await safeClick([
      'a:has-text("Transfer")', 'a:has-text("Transfers")',
      'a[href*="transfer"]', 'a[href*="Transfer"]',
    ], 'Transfer orders navigation');
  });

  // ── 9. Production Orders ───────────────────────────────────────────────────
  await inspectArea('09-production-orders', 'Production order list and creation', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await safeClick([
      'a:has-text("Production")', 'a:has-text("Manufacturing")',
      '[data-module="production"]', 'a[href*="production"]', 'a[href*="Production"]',
    ], 'Production navigation');
  });

  // ── 10. Sales / Shipping Orders ───────────────────────────────────────────
  await inspectArea('10-sales-shipping', 'Sales orders and shipping workflow', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await safeClick([
      'a:has-text("Sales")', 'a:has-text("Sales Order")', 'a:has-text("Shipping")',
      '[data-module="sales"]', 'a[href*="sales"]', 'a[href*="Sales"]', 'a[href*="ship"]',
    ], 'Sales/Shipping navigation');
  });

  // ── 11. Labels ─────────────────────────────────────────────────────────────
  await inspectArea('11-labels', 'Label printing and management', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await safeClick([
      'a:has-text("Label")', 'a:has-text("Labels")', 'a:has-text("Print")',
      'a[href*="label"]', 'a[href*="Label"]',
    ], 'Labels navigation');
  });

  // ── 12. Navigation overview ─────────────────────────────────────────────────
  await inspectArea('12-full-nav', 'Full navigation/menu overview — all available modules', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    // Capture entire nav
    const navEl = await page.$('nav, .navbar, .sidebar, #menu, #navigation, [role="navigation"]');
    if (navEl) {
      await navEl.screenshot({ path: join(SCREENSHOTS, '12-full-nav.png') });
    }
  });

  await saveReport();
  await browser.close();
  console.log('\n✅ Inspection complete. See inspection-report.json and screenshots/');
}

async function saveReport() {
  writeFileSync('./inspection-report.json', JSON.stringify(notes, null, 2));
  console.log('\n📄 Report saved: inspection-report.json');
}

main().catch(async (err) => {
  console.error('\n❌ Fatal error:', err.message);
  try {
    if (page) await page.screenshot({ path: join(SCREENSHOTS, 'fatal-error.png') });
  } catch {}
  try {
    if (browser) await browser.close();
  } catch {}
  writeFileSync('./inspection-report.json', JSON.stringify({ error: err.message, notes }, null, 2));
  process.exit(1);
});
