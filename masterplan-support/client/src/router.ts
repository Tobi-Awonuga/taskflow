import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderItemRequests } from './pages/itemRequests.js';
import { renderItemRequestDetail } from './pages/itemRequestDetail.js';
import { renderQaChecklists } from './pages/qaChecklists.js';
import { renderFgReleases } from './pages/fgReleases.js';
import { renderSops } from './pages/sops.js';
import { renderAuditLog } from './pages/auditLog.js';

type RouteHandler = (params: Record<string, string>) => void;

const routes: { pattern: RegExp; keys: string[]; handler: RouteHandler }[] = [];

function addRoute(path: string, handler: RouteHandler): void {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' + path.replace(/:([a-z]+)/gi, (_m, key) => { keys.push(key); return '([^/]+)'; }) + '$'
  );
  routes.push({ pattern, keys, handler });
}

addRoute('/login', () => renderLogin());
addRoute('/dashboard', () => renderDashboard());
addRoute('/item-requests', () => renderItemRequests());
addRoute('/item-requests/:id', ({ id }) => renderItemRequestDetail(Number(id)));
addRoute('/qa-checklists', () => renderQaChecklists());
addRoute('/fg-releases', () => renderFgReleases());
addRoute('/sops', () => renderSops());
addRoute('/audit-log', () => renderAuditLog());

export function navigate(path: string): void {
  window.location.hash = '#' + path;
}

export function initRouter(): void {
  function handleRoute(): void {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const token = localStorage.getItem('token');

    if (!token && hash !== '/login') {
      navigate('/login');
      return;
    }
    if (token && hash === '/login') {
      navigate('/dashboard');
      return;
    }

    for (const route of routes) {
      const match = route.pattern.exec(hash);
      if (match) {
        const params: Record<string, string> = {};
        route.keys.forEach((k, i) => { params[k] = match[i + 1] ?? ''; });
        route.handler(params);
        return;
      }
    }

    // 404 fallback
    navigate('/dashboard');
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
