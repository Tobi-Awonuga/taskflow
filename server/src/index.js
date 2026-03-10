require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes  = require('./routes/auth.routes');
const ssoRoutes   = require('./routes/sso.routes');
const taskRoutes  = require('./routes/tasks.routes');
const requireAuth = require('./middleware/requireAuth');
const requireApproved = require('./middleware/requireApproved');

const app  = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(cors({
  origin:      process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,   // required for cookies
}));

app.use(express.json());
app.use(cookieParser());

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth',        authRoutes);
app.use('/api/auth',        ssoRoutes);
app.use('/api/tasks',       requireAuth, requireApproved, taskRoutes);
app.use('/api/tasks',       requireAuth, requireApproved, require('./routes/comments.routes'));
app.use('/api/departments', require('./routes/departments.routes'));
app.use('/api/users',       require('./routes/users.routes'));
app.use('/api/audit',       requireAuth, requireApproved, require('./routes/audit.routes'));
app.use('/api/reports',     requireAuth, requireApproved, require('./routes/reports.routes'));

// DEV ONLY — remove before production (see routes/dev.routes.js)
if (process.env.NODE_ENV !== 'production') {
  const devRoutes = require('./routes/dev.routes');
  app.use('/api/dev', devRoutes);
}

// ── Global error handler ───────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`TaskFlow server running on http://localhost:${PORT}`);
});
