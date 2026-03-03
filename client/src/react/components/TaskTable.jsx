const STATUS_COLOR = {
  TODO:        '#4C8DFF',
  IN_PROGRESS: '#F4A23A',
  DONE:        '#43B96D',
  BLOCKED:     '#F05A5A',
  CANCELLED:   '#9CA3AF',
};

const PRIORITY_COLOR = {
  LOW:    '#9CA3AF',
  MEDIUM: '#6B7280',
  HIGH:   '#F97316',
  URGENT: '#EF4444',
};

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] ?? '#9CA3AF';
  return (
    <span
      style={{ background: `${c}18`, color: c, border: `1px solid ${c}38` }}
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
    >
      {status.replace('_', ' ')}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const c = PRIORITY_COLOR[priority] ?? '#9CA3AF';
  return (
    <span style={{ color: c }} className="text-xs font-bold uppercase tracking-wide">
      {priority}
    </span>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function TaskTable({ tasks, loading }) {
  let body;

  if (loading) {
    body = (
      <tr>
        <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
          Loading…
        </td>
      </tr>
    );
  } else if (tasks.length === 0) {
    body = (
      <tr>
        <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
          No tasks found.
        </td>
      </tr>
    );
  } else {
    body = tasks.map((task, idx) => (
      <tr
        key={task.id}
        className={`border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
      >
        <td className="px-5 py-3.5">
          <span className="text-sm font-medium text-gray-800">{task.title}</span>
          {task.assignedToUserId && (
            <span className="block text-xs text-gray-400 mt-0.5">
              User #{task.assignedToUserId}
            </span>
          )}
        </td>
        <td className="px-4 py-3.5"><StatusBadge status={task.status} /></td>
        <td className="px-4 py-3.5"><PriorityBadge priority={task.priority} /></td>
        <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
          {formatDate(task.updatedAt)}
        </td>
      </tr>
    ));
  }

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3.5">Title</th>
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Status</th>
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Priority</th>
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Updated</th>
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}
