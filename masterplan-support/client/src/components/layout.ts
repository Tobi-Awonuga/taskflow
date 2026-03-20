import { navigate } from '../router.js';

export function getUser() {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as import('../types').User;
  } catch {
    return null;
  }
}

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
}

const navSections: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [{ label: 'Dashboard', icon: '📊', route: '/dashboard' }],
  },
  {
    section: 'Item Control',
    items: [
      { label: 'Item Requests', icon: '📋', route: '/item-requests' },
    ],
  },
  {
    section: 'Quality & Safety',
    items: [
      { label: 'QA Receiving', icon: '🔍', route: '/qa-checklists' },
      { label: 'FG Releases', icon: '✅', route: '/fg-releases' },
    ],
  },
  {
    section: 'Knowledge',
    items: [{ label: 'SOP Portal', icon: '📚', route: '/sops' }],
  },
  {
    section: 'Governance',
    items: [
      { label: 'Audit Log', icon: '🗒️', route: '/audit-log', roles: ['admin', 'approver'] },
    ],
  },
];

export function renderLayout(content: string, activeRoute: string): void {
  const user = getUser();
  if (!user) {
    navigate('/login');
    return;
  }

  const navHtml = navSections
    .map((section) => {
      const links = section.items
        .filter((item) => !item.roles || item.roles.includes(user.role))
        .map(
          (item) => `
        <button class="nav-link ${activeRoute === item.route ? 'active' : ''}"
                data-route="${item.route}">
          <span>${item.icon}</span>
          <span>${item.label}</span>
        </button>`
        )
        .join('');

      if (!links) return '';
      return `<div class="sidebar-section">${section.section}</div>${links}`;
    })
    .join('');

  document.getElementById('app')!.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">🍞 CT Bakery</div>
          <div class="sidebar-sub">Ops Support Layer</div>
        </div>
        <nav class="sidebar-nav">${navHtml}</nav>
        <div class="sidebar-footer">
          <div class="sidebar-user-name">${user.name}</div>
          <div>${user.role} · ${user.department}</div>
          <button id="logout-btn" style="margin-top:10px;background:none;border:none;color:#9ca3af;cursor:pointer;font-size:12px;padding:0;">
            Sign out
          </button>
        </div>
      </aside>
      <main class="main-content">${content}</main>
    </div>
  `;

  // Nav links
  document.querySelectorAll('.nav-link[data-route]').forEach((el) => {
    el.addEventListener('click', () => {
      navigate((el as HTMLElement).dataset['route']!);
    });
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  });
}

export function badge(status: string): string {
  const label = status.replace(/_/g, ' ');
  return `<span class="badge badge-${status}">${label}</span>`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function showAlert(container: HTMLElement, message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'success'): void {
  const div = document.createElement('div');
  div.className = `alert alert-${type}`;
  div.textContent = message;
  container.prepend(div);
  setTimeout(() => div.remove(), 4000);
}
