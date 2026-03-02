// TODO: Import router / SPA logic when pages are implemented
import { renderNavbar } from './components/navbar.js';

const app = document.getElementById('app');

function render() {
  app.innerHTML = `
    ${renderNavbar()}
    <main style="padding: 2rem; font-family: sans-serif;">
      <h1>TaskFlow &ndash; Skeleton Ready</h1>
      <p>Replace this placeholder with your router / page logic.</p>
    </main>
  `;
}

render();
