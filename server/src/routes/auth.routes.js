'use strict';
const { Router }   = require('express');
const { z }        = require('zod');
const { eq }       = require('drizzle-orm');
const { db, sqlite } = require('../db/client');
const { users }    = require('../db/schema');
const rateLimit    = require('express-rate-limit');
const { verifyPassword }              = require('../lib/password');
const { createSession, revokeSession,
        setSessionCookie, clearSessionCookie } = require('../lib/sessions');
const { writeAuditLog, AUDIT_ACTIONS } = require('../lib/audit');
const requireAuth                     = require('../middleware/requireAuth');

const DUMMY_HASH = '$2b$12$invalidhashpaddingtoensureconstanttimexxxxxxxxxxxxxxxxxxx';

const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many login attempts. Try again in 15 minutes.' },
});

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
router.post('/login', loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { email, password } = parsed.data;
  const user = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();

  const hashToCheck = (user && user.isActive) ? user.passwordHash : DUMMY_HASH;
  const passwordOk  = verifyPassword(password, hashToCheck);
  if (!user || !user.isActive || !passwordOk) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const ip        = req.ip;
  const userAgent = req.headers['user-agent'] ?? null;

  const doLogin = sqlite.transaction(() => {
    const sessionId = createSession(user.id, { ip, userAgent });
    writeAuditLog({
      actorUserId:  user.id,
      action:       AUDIT_ACTIONS.LOGIN_SUCCESS,
      entityType:   'SESSION',
      departmentId: user.departmentId,
      after:        { userId: user.id, ip },
    });
    return sessionId;
  });

  const sessionId = doLogin();
  setSessionCookie(res, sessionId);
  return res.json(safeUser(user));
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  revokeSession(req.sessionId);
  clearSessionCookie(res);

  writeAuditLog({
    actorUserId:  req.user.id,
    action:       AUDIT_ACTIONS.LOGOUT,
    entityType:   'SESSION',
    departmentId: req.user.departmentId,
  });

  return res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  return res.json(safeUser(req.user));
});

module.exports = router;
