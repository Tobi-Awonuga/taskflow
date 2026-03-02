const prisma = require('../db');

async function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user) {
      // Session references a deleted/missing user
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = user; // { id, role, departmentId, ... } available to all downstream handlers
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
