/**
 * CT Bakery — Extract Purchase Orders from Masterplan
 *
 * READ-ONLY. Navigates to the PO report in Masterplan,
 * extracts open PO data, and posts it to the support layer.
 *
 * Usage: npm run extract:pos
 */

import { MasterplanClient } from './masterplan-client.js';
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  console.log('=== CT Bakery: Extract Purchase Orders ===');
  console.log('Mode: READ-ONLY — no data will be modified in Masterplan');
  console.log('');

  const client = new MasterplanClient();

  try {
    await client.launch();
    await client.login();

    const page = client.getPage();

    // ── Navigate to PO report ─────────────────────────────────────────────────
    // NOTE: Update URL paths and selectors to match actual Masterplan navigation.
    // This is a template — inspect the actual Masterplan UI to find correct routes.
    console.log('[extract-pos] Navigating to Purchase Orders…');

    // Try common navigation patterns
    try {
      // Option A: direct URL
      await page.goto(process.env['MASTERPLAN_URL'] + 'purchasing/purchase-orders', {
        waitUntil: 'networkidle',
        timeout: 15000,
      });
    } catch {
      // Option B: menu navigation
      console.log('[extract-pos] Direct URL failed, trying menu navigation…');
      await page.click('a:has-text("Purchasing"), a:has-text("Purchase"), [data-module="purchasing"]');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      await page.click('a:has-text("Purchase Orders"), a:has-text("PO List")');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
    }

    // ── Apply "Open" filter if available ──────────────────────────────────────
    try {
      const statusFilter = await page.$('select[name="status"], #statusFilter, #po-status-filter');
      if (statusFilter) {
        await statusFilter.selectOption('Open');
        await page.click('button:has-text("Search"), button:has-text("Filter"), button[type="submit"]');
        await page.waitForLoadState('networkidle');
      }
    } catch {
      console.log('[extract-pos] No status filter found, extracting all visible records');
    }

    // ── Extract the table ─────────────────────────────────────────────────────
    const poData = await client.extractTable('table');
    console.log(`[extract-pos] Extracted ${poData.length} PO records`);

    if (poData.length === 0) {
      // Fallback: take a screenshot so we can debug the selector
      await page.screenshot({ path: 'tmp/po-page-debug.png' });
      console.warn('[extract-pos] No records found. Screenshot saved to tmp/po-page-debug.png');
      console.warn('[extract-pos] Update the table selector to match actual Masterplan UI');
    }

    // ── Save locally ──────────────────────────────────────────────────────────
    const outDir = 'tmp';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outFile = path.join(outDir, `pos-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(poData, null, 2));
    console.log(`[extract-pos] Saved to ${outFile}`);

    // ── Post to support layer ─────────────────────────────────────────────────
    await client.postToSupportLayer('purchase_orders', poData);

    console.log('\n✅ PO extraction complete');
  } catch (err) {
    console.error('[extract-pos] ERROR:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
