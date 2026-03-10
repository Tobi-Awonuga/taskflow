'use strict';

function requireApproved(req, res, next) {
  if (!req.user?.isActive) {
    return res.status(403).json({ error: 'Account inactive' });
  }

  if (req.user.approvalStatus !== 'APPROVED') {
    return res.status(403).json({ error: 'Approval required', approvalStatus: req.user.approvalStatus });
  }

  next();
}

module.exports = requireApproved;
