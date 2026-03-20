/**
 * Phase 1 — Login + trigger 2FA code send.
 * Saves browser storage state so Phase 2 can resume.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const BASE_URL  = process.env.MASTERPLAN_BASE_URL ?? 'https://preview.masterplansolutions.com/';
const USERNAME  = process.env.MASTERPLAN_USERNAME;
const PASSWORD  = process.env.MASTERPLAN_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('ERROR: MASTERPLAN_USERNAME and MASTERPLAN_PASSWORD must be set.');
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

console.log('Navigating to Masterplan…');
await page.goto(BASE_URL + 'SignIn/', { waitUntil: 'networkidle', timeout: 30000 });

console.log('Filling credentials…');
await page.fill('#Email', USERNAME);
await page.fill('input[type="password"]', PASSWORD);
await page.click('input[type="submit"]');
await page.waitForURL('**/SendCode**', { timeout: 20000 }).catch(() => {});

const url = page.url();
console.log('Redirected to:', url);

if (!url.includes('SendCode')) {
  console.error('Unexpected URL after login — may already be logged in or an error occurred.');
  await page.screenshot({ path: 'screenshots/phase1-unexpected.png' });
  await browser.close();
  process.exit(1);
}

// Trigger the email code send
console.log('Clicking Submit to send 2FA code to email…');
await page.click('input[type="submit"], button[type="submit"]');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/phase1-code-sent.png' });

// Save session state (cookies) so phase 2 can resume
await context.storageState({ path: './session.json' });
console.log('\n✅ Code sent to your email. Session saved.');
console.log('   Give me the code and I will run phase 2.');

await browser.close();
