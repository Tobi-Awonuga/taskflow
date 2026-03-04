'use strict';
const { randomUUID } = require('crypto');
const { eq, and, isNull, gt } = require('drizzle-orm');
const { db } = require('../db/client');
const { sessions, users } = require('../db/schema');

const TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS || '7', 10);
const COOKIE_NAME = 'taskflow_session';

/** ISO string for now + N days */
function expiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + TTL_DAYS);
  return d.toISOString();
}

/**
 * Create a new session for a user.
 * Returns the session id (set as cookie value).
 */
function createSession(userId, { ip = null, userAgent = null } = {}) {
  const id = randomUUID();
  db.insert(sessions).values({
    id,
    userId,
    expiresAt: expiresAt(),
    ip,
    userAgent,
  }).run();
  return id;
}

/**
 * Validate a session cookie value.
 * Returns { session, user } or null if invalid/expired/revoked.
 */
function validateSession(sessionId) {
  if (!sessionId) return null;

  const now = new Date().toISOString();

  const session = db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, now),
        isNull(sessions.revokedAt),
      ),
    )
    .get();

  if (!session) return null;

  const user = db
    .select()
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.isActive, 1)))
    .get();

  if (!user) return null;

  return { session, user };
}

/**
 * Revoke a session (logout).
 */
function revokeSession(sessionId) {
  db.update(sessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(sessions.id, sessionId))
    .run();
}

/**
 * Set the session cookie on a response.
 */
function setSessionCookie(res, sessionId) {
  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   TTL_DAYS * 24 * 60 * 60 * 1000,
    // secure: true  — enable in production behind HTTPS
  });
}

/**
 * Clear the session cookie on a response.
 */
function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

module.exports = {
  COOKIE_NAME,
  createSession,
  validateSession,
  revokeSession,
  setSessionCookie,
  clearSessionCookie,
};
