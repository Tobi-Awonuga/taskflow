/**
 * CT Bakery — Masterplan Browser Client
 *
 * READ-ONLY automation utility.
 * Used ONLY for data extraction and reporting — never for data modification.
 *
 * Credentials are loaded from environment variables:
 *   MASTERPLAN_URL, MASTERPLAN_USER, MASTERPLAN_PASS
 */

import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const MASTERPLAN_URL = process.env['MASTERPLAN_URL'] ?? 'https://preview.masterplansolutions.com/';
const MASTERPLAN_USER = process.env['MASTERPLAN_USER'];
const MASTERPLAN_PASS = process.env['MASTERPLAN_PASS'];

if (!MASTERPLAN_USER || !MASTERPLAN_PASS) {
  throw new Error('MASTERPLAN_USER and MASTERPLAN_PASS must be set in .env');
}

export class MasterplanClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async launch(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    this.page = await this.context.newPage();
    console.log('[MasterplanClient] Browser launched');
  }

  async login(): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');

    console.log('[MasterplanClient] Navigating to login page…');
    await this.page.goto(MASTERPLAN_URL, { waitUntil: 'networkidle' });

    // Fill login form — selectors may need adjustment based on actual Masterplan UI
    // These are common patterns; update to match actual field IDs/names
    try {
      await this.page.fill('input[name="username"], input[type="email"], #username, #UserName', MASTERPLAN_USER!);
      await this.page.fill('input[name="password"], input[type="password"], #password, #Password', MASTERPLAN_PASS!);
      await this.page.click('button[type="submit"], input[type="submit"], .login-btn, #login-button');
      await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 });
      console.log('[MasterplanClient] Logged in successfully');
    } catch (err) {
      console.error('[MasterplanClient] Login failed — check selectors or credentials');
      await this.page.screenshot({ path: '../tmp/login-error.png' });
      throw err;
    }
  }

  getPage(): Page {
    if (!this.page) throw new Error('Browser not launched');
    return this.page;
  }

  async close(): Promise<void> {
    await this.browser?.close();
    console.log('[MasterplanClient] Browser closed');
  }

  /**
   * Extract a data table from the current page.
   * Reads <table> headers and rows into an array of objects.
   */
  async extractTable(tableSelector = 'table'): Promise<Record<string, string>[]> {
    const page = this.getPage();
    return page.evaluate((sel: string) => {
      const table = document.querySelector(sel);
      if (!table) return [];

      const headers = Array.from(table.querySelectorAll('thead th, thead td')).map(
        (th) => th.textContent?.trim() ?? ''
      );

      return Array.from(table.querySelectorAll('tbody tr')).map((row) => {
        const cells = Array.from(row.querySelectorAll('td')).map((td) => td.textContent?.trim() ?? '');
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { if (h) obj[h] = cells[i] ?? ''; });
        return obj;
      });
    }, tableSelector);
  }

  /**
   * Post extracted data to the support layer API.
   */
  async postToSupportLayer(dataType: string, data: unknown[]): Promise<void> {
    const apiBase = process.env['SUPPORT_LAYER_URL'] ?? 'http://localhost:3001';
    const token = process.env['SUPPORT_LAYER_TOKEN'];

    const res = await fetch(`${apiBase}/api/masterplan-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ dataType, data, source: 'playwright_auto' }),
    });

    if (!res.ok) {
      console.warn(`[MasterplanClient] Failed to post ${dataType} data: ${res.status}`);
    } else {
      console.log(`[MasterplanClient] Posted ${data.length} ${dataType} records`);
    }
  }
}
