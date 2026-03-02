// TODO: Check req.session.userRole against allowed roles

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.session.userRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = requireRole;
