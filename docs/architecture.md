# TaskFlow Architecture

## 1. Stack

- Frontend: Vite + Vanilla JS
- Backend: Node.js + Express
- Database: SQLite + Prisma
- Authentication: Session-based (cookies)

---

## 2. Core Entities

### Department
- Each task MUST belong to a department.
- Departments are never hard-deleted (future: archive instead).

### User
Fields:
- id
- email (unique)
- name
- role: "USER" | "SUPER" | "ADMIN"
- departmentId
- passwordHash

Rules:
- Users are not hard-deleted (audit integrity preserved).
- Every user belongs to exactly one department.
- Roles define permission boundaries.

### Task
Fields:
- id
- title
- description (optional)
- status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED"
- priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
- departmentId (required)
- createdByUserId (required)
- assignedToUserId (optional)
- dueAt (optional DateTime)
- completedAt (DateTime, required when DONE)

---

## 3. System Invariants (Must Always Hold)

1. Every task has a creator (createdByUserId required).
2. Every task belongs to a department (departmentId required).
3. If assigned, the assignee MUST belong to the same department as the task.
4. A task MUST be assigned before moving to IN_PROGRESS.
5. When status becomes DONE, completedAt must be set.
6. When reopening a task, completedAt must be cleared.
7. No hard deletes for users or departments.

---

## 4. Creation Rules

- Default: task.departmentId = creator.departmentId
- ADMIN may override department during creation (cross-department creation).
- Only SUPER and ADMIN may set or modify dueAt.

---

## 5. Permission Model (Granular - Model B)

Permissions come from two sources:
1) **Role-based authority** (ADMIN/SUPER/USER)
2) **Context-based authority** (CREATOR/ASSIGNEE relationship to a specific task)

### 5.1 Role-Based Authority

**ADMIN**
- Full control over all tasks across all departments.

**SUPER**
- Can manage tasks within their own department.
- Includes: assigning/reassigning, unassigning, and status updates (within department boundaries).

**USER**
- No department-wide authority.
- Permissions depend on whether they are the task creator or assignee.

### 5.2 Context-Based Authority

**CREATOR (any role)**
- The creator is the user who created the task (createdByUserId).
- Can manage tasks they created, as long as department rules are respected.
- Does not override ADMIN rules and cannot break invariants.

**ASSIGNEE**
- The assignee is the user currently assigned to the task (assignedToUserId).
- Can move the status of tasks assigned to them (within status transition rules).
- May self-unassign only if status = TODO.
- Cannot assign/reassign a task to another user unless also SUPER or ADMIN.

---

## 6. Assignment Rules

- Assignment is optional while status is TODO.
- A task MUST be assigned before moving to IN_PROGRESS.
- If assigned, assignee must belong to the same department as the task.

Who can assign/reassign/unassign:
- ADMIN: any task, any department
- SUPER: tasks in their department
- CREATOR: tasks they created (must still respect department rules)
- ASSIGNEE: may self-unassign only if status = TODO

---

## 7. Status Transition Rules

TODO → IN_PROGRESS
- Must be assigned
- Allowed: assignee, SUPER, ADMIN

IN_PROGRESS → DONE
- Allowed: assignee, SUPER, ADMIN
- Must set completedAt

DONE → IN_PROGRESS (reopen)
- Allowed: SUPER, ADMIN
- Must clear completedAt

Any → BLOCKED
- Allowed: assignee, SUPER, ADMIN

BLOCKED → TODO or IN_PROGRESS
- Allowed: assignee, SUPER, ADMIN
- If moving to IN_PROGRESS, must be assigned