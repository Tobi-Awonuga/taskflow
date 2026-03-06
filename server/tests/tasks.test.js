import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

const { default: app } = await import('../src/index.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loginAs(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status}`);
  return res.headers['set-cookie'][0];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/tasks', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('returns task list for ADMIN', async () => {
    const cookie = await loginAs('admin@taskflow.com', 'admin123');
    const res = await request(app).get('/api/tasks').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('returns task list for USER', async () => {
    const cookie = await loginAs('user@taskflow.com', 'user123');
    const res = await request(app).get('/api/tasks').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
  });

  it('rejects invalid status filter', async () => {
    const cookie = await loginAs('admin@taskflow.com', 'admin123');
    const res = await request(app)
      .get('/api/tasks?status=INVALID')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tasks', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'Test' });
    expect(res.status).toBe(401);
  });

  it('creates a task as ADMIN', async () => {
    const cookie = await loginAs('admin@taskflow.com', 'admin123');
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ title: 'Test task from vitest', priority: 'HIGH' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test task from vitest');
    expect(res.body.status).toBe('TODO');
  });

  it('returns 400 for missing title', async () => {
    const cookie = await loginAs('admin@taskflow.com', 'admin123');
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ priority: 'HIGH' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tasks/stats', () => {
  it('returns stats object for ADMIN', async () => {
    const cookie = await loginAs('admin@taskflow.com', 'admin123');
    const res = await request(app).get('/api/tasks/stats').set('Cookie', cookie);
    expect(res.status).toBe(200);
    const { todo, inProgress, blocked, done, cancelled, overdue, dueSoon } = res.body;
    for (const val of [todo, inProgress, blocked, done, cancelled, overdue, dueSoon]) {
      expect(typeof val).toBe('number');
    }
  });
});
