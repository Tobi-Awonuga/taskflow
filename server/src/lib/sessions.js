'use strict';
const { randomUUID } = require('crypto');
const { eq, and, isNull, gt } = require('drizzle-orm');
const { db } = require('../db/client');
const { sessions, users } = require('../db/schema');

const TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS || '7', 10);
const COOKIE_NAME = 'taskflow_session';

const { toMysqlDatetime, mysqlNow } = require('../utils/datetime');

/** MySQL datetime string for now + N days */
function expiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + TTL_DAYS);
  return toMysqlDatetime(d);
}

/**
 * Create a new session for a user.
 * Returns the session id (set as cookie value).
 */
async function createSession(userId, { ip = null, userAgent = null } = {}, client = db) {
  const id = randomUUID();
  await client.insert(sessions).values({
    id,
    userId,
    expiresAt: expiresAt(),
    ip,
    userAgent,
  });
  return id;
}

/**
 * Validate a session cookie value.
 * Returns { session, user } or null if invalid/expired/revoked.
 */
async function validateSession(sessionId) {
  if (!sessionId) return null;

  const now = mysqlNow();

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, now),
        isNull(sessions.revokedAt),
      ),
    );

  if (!session) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.isActive, true)));

  if (!user) return null;

  return { session, user };
}

/**
 * Revoke a session (logout).
 */
async function revokeSession(sessionId) {
  await db.update(sessions)
    .set({ revokedAt: mysqlNow() })
    .where(eq(sessions.id, sessionId));
}

/**
 * Set the session cookie on a response.
 */
function setSessionCookie(res, sessionId) {
  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   TTL_DAYS * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
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
