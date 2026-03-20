import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, department: user.department },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    },
  });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, department: users.department })
    .from(users)
    .where(eq(users.id, req.user!.userId));

  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(user);
});

export default router;
