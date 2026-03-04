require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes  = require('./routes/auth.routes');
const taskRoutes  = require('./routes/tasks.routes');
const requireAuth = require('./middleware/requireAuth');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(cors({
  origin:      'http://localhost:5173',
  credentials: true,   // required for cookies
}));

app.use(express.json());
app.use(cookieParser());

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth',  authRoutes);
app.use('/api/tasks', taskRoutes);

// GET /api/me — convenience alias expected by the frontend
app.get('/api/me', requireAuth, (req, res) => {
  const { passwordHash: _h, ...safe } = req.user;
  res.json(safe);
});

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
