'use strict';
const { COOKIE_NAME, validateSession } = require('../lib/sessions');

/**
 * Validates the session cookie and attaches req.user + req.sessionId.
 * Returns 401 if missing, expired, revoked, or user is inactive.
 */
async function requireAuth(req, res, next) {
  try {
    const sessionId = req.cookies[COOKIE_NAME];
    const result    = await validateSession(sessionId);

    if (!result) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user      = result.user;
    req.sessionId = sessionId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
