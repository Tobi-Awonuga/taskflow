'use strict';

const crypto = require('crypto');
const { Router } = require('express');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { and, eq } = require('drizzle-orm');

const { db } = require('../db/client');
const { users } = require('../db/schema');
const { createSession, setSessionCookie } = require('../lib/sessions');
const { writeAuditLog, AUDIT_ACTIONS } = require('../lib/audit');
const asyncHandler = require('../utils/asyncHandler');
const { mysqlNow } = require('../utils/datetime');

const router = Router();

const {
  AZURE_CLIENT_ID,
  AZURE_TENANT_ID,
  AZURE_CLIENT_SECRET,
  AZURE_REDIRECT_URI,
  AZURE_POST_LOGIN_REDIRECT = 'http://localhost:5173',
} = process.env;

const STATE_COOKIE = 'taskflow_sso_state';
const MS_SCOPES = ['openid', 'profile', 'email'];

function ssoConfigured() {
  return Boolean(
    AZURE_CLIENT_ID &&
    AZURE_TENANT_ID &&
    AZURE_CLIENT_SECRET &&
    AZURE_REDIRECT_URI,
  );
}

function buildMsalClient() {
  if (!ssoConfigured()) {
    throw new Error('Microsoft SSO env vars are missing');
  }

  return new ConfidentialClientApplication({
    auth: {
      clientId: AZURE_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
      clientSecret: AZURE_CLIENT_SECRET,
    },
  });
}

function frontendRedirect(path = '', params = {}) {
  const target = new URL(path, AZURE_POST_LOGIN_REDIRECT);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      target.searchParams.set(key, value);
    }
  });
  return target.toString();
}

router.get('/microsoft/start', asyncHandler(async (req, res) => {
  if (!ssoConfigured()) {
    return res.status(500).json({ error: 'Microsoft SSO is not configured' });
  }

  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
  });

  const msalClient = buildMsalClient();
  const authUrl = await msalClient.getAuthCodeUrl({
    scopes: MS_SCOPES,
    redirectUri: AZURE_REDIRECT_URI,
    state,
  });

  return res.redirect(authUrl);
}));

router.get('/microsoft/callback', asyncHandler(async (req, res) => {
  if (!ssoConfigured()) {
    return res.redirect(frontendRedirect('/login', { error: 'sso_not_configured' }));
  }

  const { code, state } = req.query;
  const expectedState = req.cookies[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE);

  if (!code || !state || state !== expectedState) {
    return res.redirect(frontendRedirect('/login', { error: 'sso_invalid_state' }));
  }

  const msalClient = buildMsalClient();
  const tokenResponse = await msalClient.acquireTokenByCode({
    code,
    scopes: MS_SCOPES,
    redirectUri: AZURE_REDIRECT_URI,
  });

  const claims = tokenResponse.idTokenClaims || {};
  const providerSubject = claims.oid || tokenResponse.account?.localAccountId || null;
  const tenantId = claims.tid || null;
  const email =
    claims.preferred_username ||
    claims.email ||
    tokenResponse.account?.username ||
    null;
  const name = claims.name || tokenResponse.account?.name || email;

  if (!email || !providerSubject || !tenantId) {
    return res.redirect(frontendRedirect('/login', { error: 'sso_claims_missing' }));
  }

  const normalizedEmail = String(email).toLowerCase();
  const [providerUser] = await db
    .select()
    .from(users)
    .where(and(
      eq(users.authProvider, 'MICROSOFT'),
      eq(users.providerSubject, providerSubject),
      eq(users.tenantId, tenantId),
    ))
    .limit(1);

  let user = providerUser;

  if (!user) {
    const [emailUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (emailUser) {
      await db.update(users)
        .set({
          authProvider: 'MICROSOFT',
          providerSubject,
          tenantId,
          name,
          updatedAt: mysqlNow(),
        })
        .where(eq(users.id, emailUser.id));

      [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, emailUser.id))
        .limit(1);
    } else {
      const result = await db.insert(users).values({
        email: normalizedEmail,
        name,
        authProvider: 'MICROSOFT',
        providerSubject,
        tenantId,
        role: 'USER',
        approvalStatus: 'PENDING',
        isActive: true,
      });

      [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, result.insertId))
        .limit(1);
    }
  }

  if (!user) {
    return res.redirect(frontendRedirect('/login', { error: 'sso_user_create_failed' }));
  }

  const ip = req.ip;
  const userAgent = req.headers['user-agent'] ?? null;

  const sessionId = await db.transaction(async (tx) => {
    const sid = await createSession(user.id, { ip, userAgent }, tx);
    await writeAuditLog({
      actorUserId: user.id,
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      entityType: 'SESSION',
      departmentId: user.departmentId,
      after: {
        userId: user.id,
        ip,
        authProvider: 'MICROSOFT',
      },
    }, tx);
    return sid;
  });

  setSessionCookie(res, sessionId);
  if (!user.isActive || user.approvalStatus !== 'APPROVED') {
    return res.redirect(frontendRedirect('/pending-approval', { sso: '1' }));
  }

  return res.redirect(frontendRedirect('/dashboard', { sso: '1' }));
}));

module.exports = router;
