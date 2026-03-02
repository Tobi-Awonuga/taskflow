// TODO: Verify that the requesting user belongs to the target department
// (or is admin/manager with cross-dept access)

function requireDeptAccess(req, res, next) {
  // Placeholder – always passes until department logic is implemented
  next();
}

module.exports = requireDeptAccess;
