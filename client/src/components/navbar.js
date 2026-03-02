// TODO: Make links reactive to current route and logged-in user role
export function renderNavbar() {
  return `
    <nav style="background:#1e293b;color:#f8fafc;padding:0.75rem 1.5rem;display:flex;gap:1.5rem;align-items:center;">
      <strong>TaskFlow</strong>
      <a href="#dashboard"   style="color:#94a3b8;">Dashboard</a>
      <a href="#my-tasks"    style="color:#94a3b8;">My Tasks</a>
      <a href="#dept-tasks"  style="color:#94a3b8;">Dept Tasks</a>
      <a href="#create-task" style="color:#94a3b8;">+ New Task</a>
      <a href="#admin-users" style="color:#94a3b8;">Admin</a>
      <span style="margin-left:auto;font-size:0.85rem;">TODO: user badge</span>
    </nav>
  `;
}
