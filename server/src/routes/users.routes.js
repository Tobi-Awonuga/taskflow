const { Router } = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

const router = Router();

// TODO: GET    /api/users       – list all users (admin only)
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// TODO: POST   /api/users       – create user (admin only)
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// TODO: PATCH  /api/users/:id   – update user (admin only)
router.patch('/:id', requireAuth, requireRole('admin'), (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// TODO: DELETE /api/users/:id   – delete user (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;
