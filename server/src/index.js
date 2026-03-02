require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/users.routes');
const deptRoutes = require('./routes/departments.routes');
const taskRoutes = require('./routes/tasks.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true, // required for cookies
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // set to true in production (HTTPS)
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
  },
}));

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth',        authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/departments', deptRoutes);
app.use('/api/tasks',       taskRoutes);

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`TaskFlow server running on http://localhost:${PORT}`);
});
