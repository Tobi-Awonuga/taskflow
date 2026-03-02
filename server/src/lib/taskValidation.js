'use strict';

/**
 * Centralized task validation — Model B (role + context authority).
 * Rules source: docs/architecture.md §3 (invariants), §5 (permissions), §6 (assignment), §7 (transitions).
 *
 * All exported functions return:
 *   { ok: true,  updates: {} }           – permitted; merge `updates` into Prisma payload
 *   { ok: false, error: string,
 *                status: 400|403 }       – rejected; respond with status + error
 */

const VALID_STATUSES = new Set(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']);

// ── Internal helpers ───────────────────────────────────────────────────────────

/** §5.1 — ADMIN: any dept. SUPER: own dept only. */
function hasRoleAuthority(actor, task) {
  if (actor.role === 'ADMIN') return true;
  if (actor.role === 'SUPER' && actor.departmentId === task.departmentId) return true;
  return false;
}

/** §5.2 — context authority: is actor the current assignee? */
function isAssignee(actor, task) {
  return task.assignedToUserId != null && task.assignedToUserId === actor.id;
}

/** §5.2 — context authority: is actor the creator? (used for assignment only, NOT status) */
function isCreator(actor, task) {
  return task.createdByUserId != null && task.createdByUserId === actor.id;
}

// ── Status transitions ─────────────────────────────────────────────────────────

/**
 * Validate a status transition request.
 *
 * Authority for status changes (§7):
 *   Assignee | SUPER (own dept) | ADMIN
 *   Creator alone does NOT grant status-change rights.
 *
 * Transition matrix (§7):
 *   TODO        → IN_PROGRESS   must be assigned
 *   IN_PROGRESS → DONE          sets completedAt          (invariant §3.5)
 *   DONE        → IN_PROGRESS   SUPER/ADMIN only; clears completedAt (§3.6)
 *   Any         → BLOCKED       —
 *   BLOCKED     → TODO          —
 *   BLOCKED     → IN_PROGRESS   must be assigned
 *
 * @param {string} from   Current task.status
 * @param {string} to     Requested status
 * @param {object} actor  req.user  { id, role, departmentId }
 * @param {object} task   Task record (assignedToUserId may reflect in-request assignment change)
 * @returns {{ ok, error?, status?, updates? }}
 */
function validateStatusTransition(from, to, actor, task) {
  // 1. Guard: valid target status
  if (!VALID_STATUSES.has(to)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid status "${to}". Allowed: ${[...VALID_STATUSES].join(', ')}`,
    };
  }

  // 2. Guard: no-op
  if (from === to) {
    return { ok: false, status: 400, error: `Task status is already "${to}"` };
  }

  // 3. Authority: assignee OR role authority (creator alone is NOT enough)
  const roleAuth = hasRoleAuthority(actor, task);
  const assignee = isAssignee(actor, task);

  if (!roleAuth && !assignee) {
    return {
      ok: false,
      status: 403,
      error: 'Only the assignee, a SUPER within this department, or an ADMIN may change task status',
    };
  }

  // 4. Transition-specific rules
  if (to === 'IN_PROGRESS') {
    // Invariant §3.4: must be assigned
    if (!task.assignedToUserId) {
      return {
        ok: false,
        status: 400,
        error: 'Task must be assigned to a user before it can move to IN_PROGRESS',
      };
    }

    // §7: DONE → IN_PROGRESS (reopen) requires SUPER or ADMIN
    if (from === 'DONE' && !roleAuth) {
      return {
        ok: false,
        status: 403,
        error: 'Only a SUPER (in this department) or ADMIN may reopen a completed task',
      };
    }

    // Invariant §3.6: clear completedAt when reopening
    return { ok: true, updates: { completedAt: null } };
  }

  if (to === 'DONE') {
    // Invariant §3.5: set completedAt
    return { ok: true, updates: { completedAt: new Date() } };
  }

  // TODO, BLOCKED — authority already verified; no side-effect fields
  return { ok: true, updates: {} };
}

// ── Assignment ─────────────────────────────────────────────────────────────────

/**
 * Validate assigning, reassigning, or unassigning a task.
 *
 * Authority for assignment (§6):
 *   ADMIN    – any task, any department
 *   SUPER    – tasks in their own department
 *   CREATOR  – tasks they created (dept rule still applies)
 *   ASSIGNEE – self-unassign only when status = TODO
 *
 * Invariants:
 *   §3.3 – assignee must be in same department as task
 *   §5.2 – assignee cannot reassign to another user unless also SUPER/ADMIN/creator
 *
 * @param {object}      task            Current task record
 * @param {object|null} newAssigneeUser Full DB user record, or null to unassign
 * @param {object}      actor           req.user  { id, role, departmentId }
 * @returns {{ ok, error?, status? }}
 */
function validateAssignment(task, newAssigneeUser, actor) {
  const roleAuth = hasRoleAuthority(actor, task);
  const creator  = isCreator(actor, task);
  const assignee = isAssignee(actor, task);

  // 1. Authority: must be at least one of role authority / creator / assignee
  if (!roleAuth && !creator && !assignee) {
    return {
      ok: false,
      status: 403,
      error: 'Only the task creator, assignee (self-unassign at TODO), a SUPER in this department, or an ADMIN may change assignment',
    };
  }

  if (newAssigneeUser === null) {
    // 2a. Unassign — pure assignee (no role authority, not creator) may only self-unassign at TODO
    if (assignee && !roleAuth && !creator && task.status !== 'TODO') {
      return {
        ok: false,
        status: 403,
        error: 'Assignees may only unassign themselves when the task status is TODO',
      };
    }
    return { ok: true, updates: {} };
  }

  // 2b. Assign / reassign — pure assignee cannot assign to another user
  if (assignee && !roleAuth && !creator) {
    return {
      ok: false,
      status: 403,
      error: 'Assignees cannot reassign a task to another user',
    };
  }

  // 2c. Invariant §3.3: assignee must be in the same department as the task
  if (newAssigneeUser.departmentId !== task.departmentId) {
    return {
      ok: false,
      status: 400,
      error: `Assignee (department ${newAssigneeUser.departmentId}) must belong to the same department as the task (department ${task.departmentId})`,
    };
  }

  return { ok: true, updates: {} };
}

module.exports = { validateStatusTransition, validateAssignment };
