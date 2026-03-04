'use strict';

/**
 * Visibility: can actor SEE this task?
 * ADMIN sees all; SUPER + USER see own department only.
 */
function canView(actor, task) {
  if (actor.role === 'ADMIN') return true;
  return task.departmentId === actor.departmentId;
}

/**
 * Can actor assign/reassign this task?
 *   ADMIN + SUPER: yes, for any visible task
 *   USER: only self-assign (assignedToUserId === actor.id)
 */
function canAssign(actor, _task, newAssigneeId) {
  if (actor.role === 'ADMIN' || actor.role === 'SUPER') return true;
  // USER may only assign to themselves or unassign themselves
  return newAssigneeId === actor.id || newAssigneeId === null;
}

/**
 * Can actor cancel this task?
 *   ADMIN + SUPER: yes for any visible task
 *   USER: only if they created it OR are assigned to it
 */
function canCancel(actor, task) {
  if (actor.role === 'ADMIN' || actor.role === 'SUPER') return true;
  return task.createdByUserId === actor.id || task.assignedToUserId === actor.id;
}

/**
 * Can actor reopen (CANCELLED → TODO) this task?
 *   ADMIN + SUPER: yes for any visible task
 *   USER: only if they created it AND it's in their department
 */
function canReopen(actor, task) {
  if (actor.role === 'ADMIN' || actor.role === 'SUPER') return true;
  return (
    task.createdByUserId === actor.id &&
    task.departmentId   === actor.departmentId
  );
}

/**
 * Build a Drizzle WHERE condition fragment for department visibility.
 * Returns the departmentId to filter on, or null for ADMIN (no filter).
 */
function visibilityDeptId(actor) {
  return actor.role === 'ADMIN' ? null : actor.departmentId;
}

module.exports = { canView, canAssign, canCancel, canReopen, visibilityDeptId };
