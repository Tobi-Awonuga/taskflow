'use strict';
const { Router } = require('express');
const { z }      = require('zod');
const { eq }     = require('drizzle-orm');
const { db }     = require('../db/client');
const { users }  = require('../db/schema');
const { verifyPassword }              = require('../lib/password');
const { createSession, revokeSession,
        setSessionCookie, clearSessionCookie } = require('../lib/sessions');
const { writeAuditLog }               = require('../lib/audit');
const requireAuth                     = require('../middleware/requireAuth');

const router = Router();

const loginSchema = z.object({
  email:    z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: '"password" is required' }),
});

function safeUser(u) {
  const { passwordHash: _h, ...rest } = u;
  return rest;
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { email, password } = parsed.data;
  const user = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const sessionId = createSession(user.id, {
    ip:        req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  });

  setSessionCookie(res, sessionId);

  writeAuditLog({
    actorUserId:  user.id,
    action:       'LOGIN_SUCCESS',
    entityType:   'SESSION',
    departmentId: user.departmentId,
    after:        { userId: user.id, ip: req.ip },
  });

  return res.json(safeUser(user));
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  revokeSession(req.sessionId);
  clearSessionCookie(res);

  writeAuditLog({
    actorUserId:  req.user.id,
    action:       'LOGOUT',
    entityType:   'SESSION',
    departmentId: req.user.departmentId,
  });

  return res.json({ ok: true });
});

// GET /api/me
router.get('/me', requireAuth, (req, res) => {
  return res.json(safeUser(req.user));
});

module.exports = router;
