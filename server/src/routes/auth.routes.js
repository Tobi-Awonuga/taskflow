const { Router } = require('express');

const router = Router();

// TODO: POST /api/auth/login  – validate credentials, create session
router.post('/login', (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// TODO: POST /api/auth/logout – destroy session
router.post('/logout', (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// TODO: GET  /api/auth/me    – return current session user
router.get('/me', (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;
