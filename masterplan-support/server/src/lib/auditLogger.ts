import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

interface AuditEntry {
  userId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    description: entry.description,
    metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    ipAddress: entry.ipAddress,
  });
}
