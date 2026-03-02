'use strict';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// DEV ONLY — remove this entire file and its registration in index.js
// before deploying to production or merging into a shared environment.
// This route bypasses all authentication checks.
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

const { Router } = require('express');
const prisma = require('../db');

const router = Router();

// POST /api/dev/login-as/:userId
// Sets a session as the given user without any credential check.
// Use this to test protected routes during development.
router.post('/login-as/:userId', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: `User ${userId} not found` });
    }

    req.session.userId = user.id;

    return res.json({
      id:           user.id,
      email:        user.email,
      role:         user.role,
      departmentId: user.departmentId,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
