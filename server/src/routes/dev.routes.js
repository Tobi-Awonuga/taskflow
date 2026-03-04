'use strict';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// DEV ONLY — remove this file and its registration in index.js before
// deploying to production. This route bypasses all authentication checks.
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

const { Router } = require('express');
const { eq }     = require('drizzle-orm');
const { db }     = require('../db/client');
const { users }  = require('../db/schema');
const { createSession, setSessionCookie } = require('../lib/sessions');

const router = Router();

// POST /api/dev/login-as/:userId
// Creates a real session for the given user without credential verification.
router.post('/login-as/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    return res.status(404).json({ error: `User ${userId} not found` });
  }

  const sessionId = createSession(user.id, {
    ip:        req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  });

  setSessionCookie(res, sessionId);

  const { passwordHash: _h, ...safeUser } = user;
  return res.json(safeUser);
});

module.exports = router;
