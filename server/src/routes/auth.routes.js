'use strict';
const crypto       = require('crypto');
const { Router }   = require('express');
const { z }        = require('zod');
const { eq }       = require('drizzle-orm');
const { db, sqlite } = require('../db/client');
const { users, sessions, passwordResetTokens } = require('../db/schema');
const rateLimit    = require('express-rate-limit');
const { verifyPassword, hashPassword } = require('../lib/password');
const { createSession, revokeSession,
        setSessionCookie, clearSessionCookie } = require('../lib/sessions');
const { writeAuditLog, AUDIT_ACTIONS } = require('../lib/audit');
const requireAuth                     = require('../middleware/requireAuth');
const { sendMail }                    = require('../lib/mailer');

const DUMMY_HASH = '$2b$12$invalidhashpaddingtoensureconstanttimexxxxxxxxxxxxxxxxxxx';

const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many login attempts. Try again in 15 minutes.' },
});

const resetLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many password reset requests. Try again in 15 minutes.' },
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '"currentPassword" is required'),
  newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
});

router.post('/change-password', requireAuth, (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { currentPassword, newPassword } = parsed.data;
  const user = db.select().from(users).where(eq(users.id, req.user.id)).get();

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  sqlite.transaction(() => {
    db.update(users)
      .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date().toISOString() })
      .where(eq(users.id, req.user.id))
      .run();
    writeAuditLog({
      actorUserId: req.user.id,
      action:      AUDIT_ACTIONS.USER_UPDATED,
      entityType:  'USER',
      entityId:    req.user.id,
      after:       { passwordChanged: true },
    });
  })();

  return res.json({ ok: true });
});

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
});

// POST /api/auth/forgot-password
router.post('/forgot-password', resetLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { email } = parsed.data;
  const user = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();

  // Always 200 to prevent email enumeration
  if (!user || !user.isActive) {
    return res.json({ ok: true });
  }

  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt }).run();

  const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
  await sendMail({
    to:      user.email,
    subject: 'Reset your Nectar password',
    html:    `<p>Hi ${user.name},</p>
              <p>Click the link below to reset your password. This link expires in 1 hour.</p>
              <p><a href="${resetUrl}">${resetUrl}</a></p>
              <p>If you did not request a password reset, you can safely ignore this email.</p>`,
  });

  return res.json({ ok: true });
});

const resetPasswordSchema = z.object({
  token:       z.string().min(1, '"token" is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/auth/reset-password
router.post('/reset-password', resetLimiter, (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { token, newPassword } = parsed.data;
  const now = new Date().toISOString();

  const record = db.select().from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .get();

  if (!record || record.usedAt || record.expiresAt < now) {
    return res.status(400).json({ error: 'Invalid or expired reset link' });
  }

  sqlite.transaction(() => {
    db.update(users)
      .set({ passwordHash: hashPassword(newPassword), updatedAt: now })
      .where(eq(users.id, record.userId))
      .run();

    db.update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, record.id))
      .run();

    // Revoke all active sessions for this user
    db.update(sessions)
      .set({ revokedAt: now })
      .where(eq(sessions.userId, record.userId))
      .run();

    writeAuditLog({
      actorUserId: record.userId,
      action:      AUDIT_ACTIONS.USER_UPDATED,
      entityType:  'USER',
      entityId:    record.userId,
      after:       { passwordReset: true },
    });
  })();

  return res.json({ ok: true });
});

module.exports = router;
