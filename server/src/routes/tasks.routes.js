const { Router } = require('express');
const requireAuth = require('../middleware/requireAuth');

const router = Router();

// TODO: GET    /api/tasks        – list tasks (filtered by role/dept)
router.get('/', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// TODO: POST   /api/tasks        – create task
router.post('/', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// TODO: GET    /api/tasks/:id    – get single task
router.get('/:id', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// TODO: PATCH  /api/tasks/:id    – update task
router.patch('/:id', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// TODO: DELETE /api/tasks/:id    – delete task
router.delete('/:id', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;
