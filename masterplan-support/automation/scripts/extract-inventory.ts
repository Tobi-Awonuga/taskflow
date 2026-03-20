/**
 * CT Bakery — Extract Inventory Snapshot from Masterplan
 *
 * READ-ONLY. Extracts current inventory levels by item and location.
 * Useful for dashboard visibility and cycle count planning.
 *
 * Usage: npm run extract:inventory
 */

import { MasterplanClient } from './masterplan-client.js';
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  console.log('=== CT Bakery: Extract Inventory Snapshot ===');
  console.log('Mode: READ-ONLY — no data will be modified in Masterplan');
  console.log('');

  const client = new MasterplanClient();

  try {
    await client.launch();
    await client.login();

    const page = client.getPage();

    // ── Navigate to Inventory report ──────────────────────────────────────────
    console.log('[extract-inventory] Navigating to Inventory…');

    try {
      await page.goto(process.env['MASTERPLAN_URL'] + 'inventory/on-hand', {
        waitUntil: 'networkidle',
        timeout: 15000,
      });
    } catch {
      await page.click('a:has-text("Inventory"), [data-module="inventory"]');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      await page.click('a:has-text("On Hand"), a:has-text("Stock"), a:has-text("Inventory List")');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
    }

    // ── Handle pagination — collect all pages ─────────────────────────────────
    const allRows: Record<string, string>[] = [];
    let pageNum = 1;

    while (true) {
      console.log(`[extract-inventory] Extracting page ${pageNum}…`);
      const rows = await client.extractTable('table');
      allRows.push(...rows);

      // Try to click "Next" pagination
      const nextBtn = await page.$('a:has-text("Next"), button:has-text("Next"), [aria-label="Next page"]');
      if (!nextBtn) break;

      const isDisabled = await nextBtn.getAttribute('disabled');
      const className = await nextBtn.getAttribute('class') ?? '';
      if (isDisabled !== null || className.includes('disabled')) break;

      await nextBtn.click();
      await page.waitForLoadState('networkidle');
      pageNum++;

      if (pageNum > 100) {
        console.warn('[extract-inventory] Reached 100 page limit — stopping pagination');
        break;
      }
    }

    console.log(`[extract-inventory] Total: ${allRows.length} inventory records across ${pageNum} page(s)`);

    // ── Save locally ──────────────────────────────────────────────────────────
    const outDir = 'tmp';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outFile = path.join(outDir, `inventory-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(allRows, null, 2));
    console.log(`[extract-inventory] Saved to ${outFile}`);

    // ── Post to support layer ─────────────────────────────────────────────────
    await client.postToSupportLayer('inventory', allRows);

    console.log('\n✅ Inventory extraction complete');
  } catch (err) {
    console.error('[extract-inventory] ERROR:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
