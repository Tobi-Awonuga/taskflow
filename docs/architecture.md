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

1. Every task has a creator.
2. Every task belongs to a department.
3. If assigned, the assignee MUST belong to the same department as the task.
4. A task MUST be assigned before moving to IN_PROGRESS.
5. When status becomes DONE, completedAt must be set.
6. When reopening a task, completedAt must be cleared.
7. No hard deletes for users or departments.

---

## 4. Creation Rules

- Default: task.departmentId = creator.departmentId
- ADMIN may override department during creation.
- Only SUPER and ADMIN may set or modify dueAt.

---

## 5. Assignment Rules

Assignment is optional in TODO state.

Who can assign/reassign:

- ADMIN: any task, any department
- SUPER: tasks within their department
- CREATOR: tasks they created (within department)
- ASSIGNEE: may self-unassign only if status = TODO

---

## 6. Status Transition Rules

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