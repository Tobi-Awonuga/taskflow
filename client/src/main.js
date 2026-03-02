import './styles.css';

// ── User (auth wiring is a separate sprint) ────────────────────────────────────
const MOCK_USER = { name: 'Alex Johnson', role: 'SUPER', avatar: 'AJ' };

// ── State ──────────────────────────────────────────────────────────────────────
const state = {
  tasks:      [],
  total:      0,
  page:       1,
  pageSize:   10,
  totalPages: 1,
  status:     '',
  priority:   '',
  loading:    true,
  error:      '',
};

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
  const stripe  = idx % 2 === 1 ? 'bg-gray-50/40' : '';
  // Real API returns assignedToUserId (int | null), not a name
  const assignee = task.assignedToUserId
    ? `<span class="block text-xs text-gray-400 mt-0.5">User #${task.assignedToUserId}</span>`
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
  const bg = highlight ? `background:${color}12;border:1px solid ${color}30` : 'background:#f9fafb;border:1px solid #f3f4f6';
  return `<div style="${bg}" class="rounded-2xl p-4 cursor-pointer hover:brightness-95 transition-all">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-gray-700">${label}</span>
      <span class="text-xl font-bold" style="color:${color}">${count}</span>
    </div>
  </div>`;
}

// ── Data loading ───────────────────────────────────────────────────────────────
async function devLoginAdmin() {
  state.loading = true;
  state.error = '';
  render();

  try {
    const res = await fetch('/api/dev/login-as/1', {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      state.error = `Dev login failed (${res.status}).`;
      state.loading = false;
      render();
      return;
    }

    await loadTasks();
    state.error = '';
  } catch {
    state.error = 'Network error during dev login.';
    state.loading = false;
    render();
  }
}

async function loadTasks() {
  state.loading = true;
  state.error   = '';
  render();

  const params = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
  if (state.status)   params.set('status',   state.status);
  if (state.priority) params.set('priority', state.priority);

  try {
    const res = await fetch(`/api/tasks?${params}`, { credentials: 'include' });

    if (res.status === 401) {
      state.error = 'Unauthorized. Use Dev Login.';
      state.tasks = [];
      state.total = 0;
      state.totalPages = 1;
    } else if (!res.ok) {
      state.error = `Server error (${res.status}). Please try again.`;
      state.tasks = [];
    } else {
      const data = await res.json();
      state.tasks      = data.tasks;
      state.total      = data.total;
      state.page       = data.page;
      state.pageSize   = data.pageSize;
      state.totalPages = data.totalPages;
    }
  } catch {
    state.error = 'Network error. Is the server running?';
    state.tasks = [];
  }

  state.loading = false;
  render();
}

// ── Main render ────────────────────────────────────────────────────────────────
function renderApp() {
  // Page-level counts (sufficient for sprint 1)
  const open       = state.tasks.filter(t => t.status === 'TODO').length;
  const inProgress = state.tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const done       = state.tasks.filter(t => t.status === 'DONE').length;
  const blocked    = state.tasks.filter(t => t.status === 'BLOCKED').length;
  const cancelled  = state.tasks.filter(t => t.status === 'CANCELLED').length;
  const assigned   = state.tasks.filter(t => t.assignedToUserId !== null).length; // TODO: filter by current user id once auth is wired
  const highPrio   = state.tasks.filter(t => t.priority === 'HIGH' || t.priority === 'URGENT').length;

  // Pagination helpers
  const from        = state.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const to          = Math.min(state.page * state.pageSize, state.total);
  const prevEnabled = state.page > 1 && !state.loading;
  const nextEnabled = state.page < state.totalPages && !state.loading;

  // Table body
  let tableBody;
  if (state.loading) {
    tableBody = `<tr><td colspan="4" class="px-5 py-10 text-center text-sm text-gray-400">Loading…</td></tr>`;
  } else if (state.tasks.length === 0) {
    tableBody = `<tr><td colspan="4" class="px-5 py-10 text-center text-sm text-gray-400">No tasks found.</td></tr>`;
  } else {
    tableBody = state.tasks.map(renderTaskRow).join('');
  }

  // Error banner
  const isUnauthorized = state.error.includes('Unauthorized');

  const errorBanner = state.error
    ? `<div class="flex items-center justify-between gap-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
        <span>${state.error}</span>
        ${isUnauthorized ? `
          <button id="btn-dev-login"
            class="shrink-0 px-3 py-1.5 rounded-lg bg-[#F0654D] text-white font-semibold hover:bg-[#E85B44] transition-colors">
            Dev Login (Admin)
          </button>
        ` : ''}
      </div>`
    : '';

  // Select options helper
  const statusOpts = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED']
    .map(s => `<option value="${s}" ${state.status === s ? 'selected' : ''}>${s}</option>`)
    .join('');
  const priorityOpts = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
    .map(p => `<option value="${p}" ${state.priority === p ? 'selected' : ''}>${p}</option>`)
    .join('');

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
              ${renderNavItem('All Tasks', true,  state.total)}
              ${renderNavItem('My Tasks',  false, assigned)}
              ${renderNavItem('Completed', false, done)}
              ${renderNavItem('Cancelled', false, cancelled)}
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
              <select id="status-filter"
                class="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#F0654D]/20 focus:border-[#F0654D]">
                <option value="" ${state.status === '' ? 'selected' : ''}>All Statuses</option>
                ${statusOpts}
              </select>
              <select id="priority-filter"
                class="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#F0654D]/20 focus:border-[#F0654D]">
                <option value="" ${state.priority === '' ? 'selected' : ''}>All Priorities</option>
                ${priorityOpts}
              </select>
            </div>

            ${errorBanner}

            <!-- Task table -->
            <div class="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-gray-100">
                    <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3.5">Title</th>
                    <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Status</th>
                    <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Priority</th>
                    <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3.5">Updated</th>
                  </tr>
                </thead>
                <tbody>${tableBody}</tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div class="flex items-center justify-between text-sm text-gray-400">
              <span>Showing ${from}–${to} of ${state.total} tasks</span>
              <div class="flex items-center gap-1">
                <button id="btn-prev" ${prevEnabled ? '' : 'disabled'}
                  class="px-3 py-1.5 rounded-lg border border-gray-200 ${prevEnabled ? 'hover:bg-gray-50 text-gray-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}">
                  Previous
                </button>
                <button class="px-3 py-1.5 rounded-lg bg-[#F0654D] text-white font-semibold">${state.page}</button>
                <button id="btn-next" ${nextEnabled ? '' : 'disabled'}
                  class="px-3 py-1.5 rounded-lg border border-gray-200 ${nextEnabled ? 'hover:bg-gray-50 text-gray-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}">
                  Next
                </button>
              </div>
            </div>
          </main>

          <!-- ── Right panel ───────────────────────────────────────────────── -->
          <aside class="border-l border-black/5 p-6 flex flex-col gap-3 overflow-y-auto">
            <h2 class="text-base font-semibold text-gray-800 mb-1">Quick Filters</h2>
            ${renderQuickFilter('All Tasks',     state.total, '#F0654D', false)}
            ${renderQuickFilter('My Tasks',      assigned,    '#4C8DFF', false)}
            ${renderQuickFilter('Blocked',       blocked,     '#F05A5A', true)}
            ${renderQuickFilter('High Priority', highPrio,    '#F97316', true)}
          </aside>

    </div>
  `;
}

// ── Event wiring ───────────────────────────────────────────────────────────────
function attachListeners() {
  document.getElementById('status-filter')?.addEventListener('change', e => {
    state.status = e.target.value;
    state.page   = 1;
    loadTasks();
  });

  document.getElementById('priority-filter')?.addEventListener('change', e => {
    state.priority = e.target.value;
    state.page     = 1;
    loadTasks();
  });

  document.getElementById('btn-prev')?.addEventListener('click', () => {
    if (state.page > 1) { state.page--; loadTasks(); }
  });

  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (state.page < state.totalPages) { state.page++; loadTasks(); }
  });

  document.getElementById('btn-dev-login')?.addEventListener('click', () => {
    devLoginAdmin();
  });
}

function render() {
  document.getElementById('app').innerHTML = renderApp();
  attachListeners();
}

// ── Init ───────────────────────────────────────────────────────────────────────
loadTasks();
