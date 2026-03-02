// TODO: Implement login, logout, and session helpers

// Placeholder: attach user to session after verifying credentials
async function login(req, user) {
  req.session.userId = user.id;
  req.session.userRole = user.role;
}

function logout(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

function currentUser(req) {
  return req.session.userId ? { id: req.session.userId, role: req.session.userRole } : null;
}

module.exports = { login, logout, currentUser };
