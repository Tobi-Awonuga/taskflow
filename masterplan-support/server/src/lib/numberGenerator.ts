import { db } from '../db/index.js';
import { itemRequests, qaChecklists, fgReleases } from '../db/schema.js';
import { sql } from 'drizzle-orm';

function zeroPad(n: number, digits = 4): string {
  return String(n).padStart(digits, '0');
}

function currentYear(): number {
  return new Date().getFullYear();
}

export async function nextItemRequestNumber(): Promise<string> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(itemRequests);
  const seq = (Number(row?.count ?? 0) + 1);
  return `ITM-${currentYear()}-${zeroPad(seq)}`;
}

export async function nextQaChecklistNumber(): Promise<string> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(qaChecklists);
  const seq = (Number(row?.count ?? 0) + 1);
  return `RCV-${currentYear()}-${zeroPad(seq)}`;
}

export async function nextFgReleaseNumber(): Promise<string> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(fgReleases);
  const seq = (Number(row?.count ?? 0) + 1);
  return `FGR-${currentYear()}-${zeroPad(seq)}`;
}
