import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb } from './helpers/db.js';

// Import app after env is set by setup.js
const { default: app } = await import('../src/index.js');

const ADMIN = { email: 'admin@taskflow.com', password: 'admin123' };

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await setupTestDb();
    // Seed just the admin user for auth tests
    const { execSync } = await import('child_process');
    execSync('node scripts/seed.js', { stdio: 'inherit' });
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@taskflow.com', password: 'admin123' });
    expect(res.status).toBe(401);
  });

  it('logs in successfully and sets session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(ADMIN.email);
    expect(res.body.role).toBe('ADMIN');
    expect(res.headers['set-cookie']).toBeDefined();
    // passwordHash must never leak
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('GET /api/auth/me returns user when session cookie is valid', async () => {
    const login = await request(app).post('/api/auth/login').send(ADMIN);
    const cookie = login.headers['set-cookie'][0];

    const me = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(ADMIN.email);
  });

  it('GET /api/auth/me returns 401 without a session cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
