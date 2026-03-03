// TODO: Render a sortable/filterable table of tasks
// Props: tasks[]
export function renderTaskTable(tasks = []) {
  if (!tasks.length) return `<p>No tasks to display.</p>`;
  return `<table><thead><tr><th>Title</th><th>Status</th><th>Assignee</th><th>Due</th></tr></thead><tbody>
    ${tasks.map((t) => `<tr><td>${t.title}</td><td>${t.status}</td><td>${t.assignee}</td><td>${t.due}</td></tr>`).join('')}
  </tbody></table>`;
}
