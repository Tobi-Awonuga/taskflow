# TaskFlow

TaskFlow is a department-based task management system.

## Tech Stack
- Frontend: Vite + Vanilla JS
- Backend: Node.js + Express
- Database: SQLite + Prisma
- Auth: Session-based (cookies)

---

## Local Setup

### 1. Install dependencies
cd server
npm install

### 2. Reset and migrate database
npx prisma migrate reset

### 3. Seed database
node prisma/seed.js

### 4. Run server
npm run dev

---

## Dev Users

Email:
- admin@taskflow.local
- super@taskflow.local
- user@taskflow.local

Password (dev only):
Taskflow123!