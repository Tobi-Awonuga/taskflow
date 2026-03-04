'use strict';
const { canCancel, canReopen } = require('./rbac');

const VALID_STATUSES   = new Set(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED']);
const VALID_PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

// Structurally permitted transitions (before RBAC)
const ALLOWED_TRANSITIONS = {
  TODO:        new Set(['IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED']),
  IN_PROGRESS: new Set(['TODO', 'DONE', 'BLOCKED', 'CANCELLED']),
  DONE:        new Set(['TODO', 'IN_PROGRESS']),   // re-open or push back
  BLOCKED:     new Set(['TODO', 'IN_PROGRESS', 'CANCELLED']),
  CANCELLED:   new Set(['TODO']),                  // reopen only
};

/**
 * Validate a status transition against structure + RBAC.
 *
 * @param {string} fromStatus  Current task.status
 * @param {string} toStatus    Requested status
 * @param {object} actor       req.user { id, role, departmentId }
 * @param {object} task        Task row from DB
 * @param {string} cancelReason Required when toStatus === 'CANCELLED'
 *
 * Returns:
 *   { ok: true,  updates: { completedAt?, cancelledAt?, ... } }
 *   { ok: false, status: HTTP_STATUS, error: message }
 */
function validateStatusTransition(fromStatus, toStatus, actor, task, cancelReason) {
  if (!VALID_STATUSES.has(toStatus)) {
    return { ok: false, status: 400, error: `"status" must be one of: ${[...VALID_STATUSES].join(', ')}` };
  }
  if (fromStatus === toStatus) {
    return { ok: false, status: 400, error: 'Task is already in that status' };
  }

  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowed || !allowed.has(toStatus)) {
    return { ok: false, status: 400, error: `Cannot transition from ${fromStatus} to ${toStatus}` };
  }

  const now = new Date().toISOString();

  // ── CANCEL ──────────────────────────────────────────────────────────────────
  if (toStatus === 'CANCELLED') {
    if (!canCancel(actor, task)) {
      return { ok: false, status: 403, error: 'You do not have permission to cancel this task' };
    }
    if (!cancelReason || !cancelReason.trim()) {
      return { ok: false, status: 400, error: '"cancelReason" is required when cancelling a task' };
    }
    return {
      ok: true,
      updates: {
        cancelledAt:       now,
        cancelledByUserId: actor.id,
        cancelReason:      cancelReason.trim(),
        completedAt:       null,
      },
    };
  }

  // ── REOPEN (CANCELLED → TODO) ────────────────────────────────────────────
  if (fromStatus === 'CANCELLED') {
    if (!canReopen(actor, task)) {
      return { ok: false, status: 403, error: 'You do not have permission to reopen this task' };
    }
    return {
      ok: true,
      updates: { cancelledAt: null, cancelledByUserId: null, cancelReason: null, completedAt: null },
    };
  }

  // ── DONE ────────────────────────────────────────────────────────────────────
  if (toStatus === 'DONE') {
    return { ok: true, updates: { completedAt: now } };
  }

  // ── RE-OPEN FROM DONE ──────────────────────────────────────────────────────
  if (fromStatus === 'DONE') {
    return { ok: true, updates: { completedAt: null } };
  }

  // All other transitions (TODO↔IN_PROGRESS, ↔BLOCKED) — no side-effect fields
  return { ok: true, updates: {} };
}

module.exports = { validateStatusTransition, VALID_STATUSES, VALID_PRIORITIES };
