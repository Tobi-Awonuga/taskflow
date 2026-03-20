import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRouter from './routes/auth.js';
import itemRequestsRouter from './routes/itemRequests.js';
import qaChecklistsRouter from './routes/qaChecklists.js';
import fgReleasesRouter from './routes/fgReleases.js';
import sopsRouter from './routes/sops.js';
import dashboardRouter from './routes/dashboard.js';
import auditLogsRouter from './routes/auditLogs.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ── Middleware ────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow: our web client, Chrome/Firefox extensions, server-to-server (no origin)
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.startsWith('chrome-extension://') ||
      origin.startsWith('moz-extension://')
    ) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/item-requests', itemRequestsRouter);
app.use('/api/qa-checklists', qaChecklistsRouter);
app.use('/api/fg-releases', fgReleasesRouter);
app.use('/api/sops', sopsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/audit-logs', auditLogsRouter);

// ── Health check ──────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'CT Bakery — Masterplan Support Layer', ts: new Date().toISOString() });
});

// ── Static (production build) ─────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ── Start ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🍞 CT Bakery Support Layer running on http://localhost:${PORT}`);
});
