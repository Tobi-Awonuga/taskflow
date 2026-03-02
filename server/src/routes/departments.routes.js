const { Router } = require('express');
const requireAuth = require('../middleware/requireAuth');

const router = Router();

// TODO: GET  /api/departments     – list departments
router.get('/', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// TODO: POST /api/departments     – create department (admin only)
router.post('/', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;
