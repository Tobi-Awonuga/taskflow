import './styles.css';

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_USER = {
  name: 'Alex Johnson',
  role: 'SUPER',
  avatar: 'AJ',
};

const MOCK_TASKS = [
  { id: 1,  title: 'Design onboarding flow',       status: 'IN_PROGRESS', priority: 'HIGH',   updatedAt: '2026-02-28T10:00:00Z', assignedTo: 'Alex Johnson' },
  { id: 2,  title: 'Fix payment gateway bug',       status: 'BLOCKED',     priority: 'URGENT', updatedAt: '2026-02-27T15:30:00Z', assignedTo: 'Sam Lee' },
  { id: 3,  title: 'Write Q1 report',               status: 'TODO',        priority: 'MEDIUM', updatedAt: '2026-02-26T09:00:00Z', assignedTo: null },
  { id: 4,  title: 'Update API documentation',      status: 'DONE',        priority: 'LOW',    updatedAt: '2026-02-25T14:00:00Z', assignedTo: 'Jordan Kim' },
  { id: 5,  title: 'Conduct user interviews',       status: 'IN_PROGRESS', priority: 'HIGH',   updatedAt: '2026-02-24T11:00:00Z', assignedTo: 'Alex Johnson' },
  { id: 6,  title: 'Deploy staging environment',    status: 'TODO',        priority: 'MEDIUM', updatedAt: '2026-02-23T16:00:00Z', assignedTo: 'Sam Lee' },
  { id: 7,  title: 'Review security audit',         status: 'BLOCKED',     priority: 'URGENT', updatedAt: '2026-02-22T13:00:00Z', assignedTo: 'Jordan Kim' },
  { id: 8,  title: 'Create marketing materials',    status: 'CANCELLED',   priority: 'LOW',    updatedAt: '2026-02-21T10:00:00Z', assignedTo: null },
  { id: 9,  title: 'Migrate legacy database',       status: 'TODO',        priority: 'HIGH',   updatedAt: '2026-02-20T09:30:00Z', assignedTo: 'Alex Johnson' },
  { id: 10, title: 'Set up CI/CD pipeline',         status: 'DONE',        priority: 'MEDIUM', updatedAt: '2026-02-19T17:00:00Z', assignedTo: 'Sam Lee' },
];

// ── Design tokens ──────────────────────────────────────────────────────────────

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

// ── Helper renderers ───────────────────────────────────────────────────────────

function statusBadge(status) {
  const c = STATUS_COLOR[status] ?? '#9CA3AF';
  const label = status.replace('_', ' ');
  return `<span style="background:${c}18;color:${c};border:1px solid ${c}38"
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap">
    ${label}
  </span>`;
}

function priorityBadge(priority) {
  const c = PRIORITY_COLOR[priority] ?? '#9CA3AF';
  return `<span style="color:${c}" class="text-xs font-bold uppercase tracking-wide">${priority}</span>`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Component renderers ────────────────────────────────────────────────────────

function renderNavItem(label, active, count) {
  if (active) {
    return `<button class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold bg-[#F0654D] text-white">
      <span>${label}</span>
      <span class="text-xs px-1.5 py-0.5 rounded-full bg-white/20 text-white">${count}</span>
    </button>`;
  }
  return `<button class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-white/60 hover:text-gray-800 transition-colors">
    <span>${label}</span>
    <span class="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500">${count}</span>
  </button>`;
}

function renderStatCard(label, count, color) {
  return `<div class="bg-white rounded-2xl p-5 border border-black/5 shadow-sm">
    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">${label}</p>
    <p class="text-3xl font-bold" style="color:${color}">${count}</p>
  </div>`;
}

function renderTaskRow(task, idx) {
  const stripe = idx % 2 === 1 ? 'bg-gray-50/40' : '';
  const assignee = task.assignedTo
    ? `<span class="block text-xs text-gray-400 mt-0.5">${task.assignedTo}</span>`
    : '';
  return `<tr class="border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer ${stripe}">
    <td class="px-5 py-3.5">
      <span class="text-sm font-medium text-gray-800">${task.title}</span>
      ${assignee}
    </td>
    <td class="px-4 py-3.5">${statusBadge(task.status)}</td>
    <td class="px-4 py-3.5">${priorityBadge(task.priority)}</td>
    <td class="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">${formatDate(task.updatedAt)}</td>
  </tr>`;
}

function renderQuickFilter(label, count, color, highlight) {
  const bg   = highlight ? `background:${color}12;border:1px solid ${color}30` : 'background:#f9fafb;border:1px solid #f3f4f6';
  return `<div style="${bg}" class="rounded-2xl p-4 cursor-pointer hover:brightness-95 transition-all">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-gray-700">${label}</span>
      <span class="text-xl font-bold" style="color:${color}">${count}</span>
    </div>
  </div>`;
}

// ── Main render ────────────────────────────────────────────────────────────────

function renderApp() {
  const open        = MOCK_TASKS.filter(t => t.status === 'TODO').length;
  const inProgress  = MOCK_TASKS.filter(t => t.status === 'IN_PROGRESS').length;
  const done        = MOCK_TASKS.filter(t => t.status === 'DONE').length;
  const blocked     = MOCK_TASKS.filter(t => t.status === 'BLOCKED').length;
  const cancelled   = MOCK_TASKS.filter(t => t.status === 'CANCELLED').length;
  const myTasks     = MOCK_TASKS.filter(t => t.assignedTo === MOCK_USER.name).length;
  const highPrio    = MOCK_TASKS.filter(t => t.priority === 'HIGH' || t.priority === 'URGENT').length;

  return `
    <div class="h-screen overflow-hidden bg-[#F6F7F9] grid grid-cols-[260px_1fr_320px]">

          <!-- ── Sidebar ──────────────────────────────────────────────────── -->
          <aside class="bg-[#F5EDE6] flex flex-col p-6 gap-5 overflow-y-auto">

            <!-- Logo -->
            <div class="flex items-center gap-2.5 mb-1">
              <div class="w-8 h-8 bg-[#F0654D] rounded-lg flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="2.5" width="14" height="2" rx="1" fill="white"/>
                  <rect x="1" y="7"   width="10" height="2" rx="1" fill="white"/>
                  <rect x="1" y="11.5" width="12" height="2" rx="1" fill="white"/>
                </svg>
              </div>
              <span class="text-lg font-bold text-gray-800 tracking-tight">TaskFlow</span>
            </div>

            <!-- User card -->
            <div class="flex items-center gap-3 p-3 bg-white/60 rounded-2xl">
              <div class="w-10 h-10 bg-[#F0654D] rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                ${MOCK_USER.avatar}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-800 truncate">${MOCK_USER.name}</p>
                <p class="text-xs text-gray-500">${MOCK_USER.role}</p>
              </div>
            </div>

            <!-- Nav -->
            <nav class="flex flex-col gap-1">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1">Menu</p>
              ${renderNavItem('All Tasks',  true,  MOCK_TASKS.length)}
              ${renderNavItem('My Tasks',   false, myTasks)}
              ${renderNavItem('Completed',  false, done)}
              ${renderNavItem('Cancelled',  false, cancelled)}
            </nav>

            <div class="flex-1"></div>

            <!-- Log out -->
            <button class="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-500 hover:text-[#F0654D] hover:bg-white/60 rounded-xl transition-colors w-full">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="shrink-0">
                <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Log Out
            </button>
          </aside>

          <!-- ── Main content ─────────────────────────────────────────────── -->
          <main class="p-8 flex flex-col gap-6 min-w-0 overflow-y-auto">

            <!-- Header -->
            <div class="flex items-center justify-between">
              <h1 class="text-2xl font-bold text-gray-800">Tasks</h1>
              <button class="flex items-center gap-2 bg-[#F0654D] hover:bg-[#E85B44] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                New Task
              </button>
            </div>

            <!-- Stat cards -->
            <div class="grid grid-cols-3 gap-4">
              ${renderStatCard('Open',        open,       '#4C8DFF')}
              ${renderStatCard('In Progress', inProgress, '#F4A23A')}
              ${renderStatCard('Completed',   done,       '#43B96D')}
            </div>

            <!-- Filters -->
            <div class="flex items-center gap-3">
              <div class="relative flex-1 max-w-xs">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M10 10l2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <input type="text" placeholder="Search tasks…"
                  class="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F0654D]/20 focus:border-[#F0654D] text-gray-700 placeholder-gray-400" />
              </div>
              <select class="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#F0654D]/20 focus:border-[#F0654D]">
                <option value="">All Statuses</option>
                <option>TODO</option>
                <option>IN_PROGRESS</option>
                <option>DONE</option>
                <option>BLOCKED</option>
                <option>CANCELLED</option>
              </select>
              <select class="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#F0654D]/20 focus:border-[#F0654D]">
                <option value="">All Priorities</option>
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
                <option>URGENT</option>
              </select>
            </div>

            <!-- Task table -->
            <div class="bg-white rounded-2xl border border-black/5 shadow-sm">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-gray-100">
                    <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3.5">Title</th>
                    <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Status</th>
                    <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Priority</th>
                    <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  ${MOCK_TASKS.map(renderTaskRow).join('')}
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div class="flex items-center justify-between text-sm text-gray-400">
              <span>Showing 1–${MOCK_TASKS.length} of ${MOCK_TASKS.length} tasks</span>
              <div class="flex items-center gap-1">
                <button disabled class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-300 cursor-not-allowed">Previous</button>
                <button class="px-3 py-1.5 rounded-lg bg-[#F0654D] text-white font-semibold">1</button>
                <button disabled class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-300 cursor-not-allowed">Next</button>
              </div>
            </div>
          </main>

          <!-- ── Right panel ───────────────────────────────────────────────── -->
          <aside class="border-l border-black/5 p-6 flex flex-col gap-3 overflow-y-auto">
            <h2 class="text-base font-semibold text-gray-800 mb-1">Quick Filters</h2>
            ${renderQuickFilter('All Tasks',      MOCK_TASKS.length, '#F0654D', false)}
            ${renderQuickFilter('My Tasks',       myTasks,           '#4C8DFF', false)}
            ${renderQuickFilter('Blocked',        blocked,           '#F05A5A', true)}
            ${renderQuickFilter('High Priority',  highPrio,          '#F97316', true)}
          </aside>

    </div>
  `;
}

document.getElementById('app').innerHTML = renderApp();
