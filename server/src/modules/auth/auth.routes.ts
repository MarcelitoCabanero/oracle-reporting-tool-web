import { Router } from 'express';
import { getPool, sql } from '../../database/db.js';
import { createToken, type AuthUser } from './token.service.js';
import { requireAuth, type AuthenticatedRequest } from './auth.middleware.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('username', sql.VarChar(50), username.trim())
      .query(`
        SELECT TOP 1 LOCATIONID, LOCATIONNAME, ORGLOCATIONREF, username, password, access, IsActive
        FROM dbo.dts_location
        WHERE username = @username AND IsActive = 1
      `);

    if (result.recordset.length === 0) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const row = result.recordset[0];

    // Plaintext password comparison as specified
    if (row.password !== password) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const accessRole = (row.access || '').trim();

    // Check role eligibility: Only Area Manager and Executive are permitted
    if (accessRole !== 'Area Manager' && accessRole !== 'Executive') {
      res.status(403).json({
        error: `Access denied. Role "${accessRole}" is not permitted to access this reporting dashboard. Only Area Managers and Executives have access.`,
      });
      return;
    }

    const authUser: AuthUser = {
      locationId: row.LOCATIONID,
      locationName: row.LOCATIONNAME,
      username: row.username,
      access: accessRole as 'Area Manager' | 'Executive',
    };

    const token = createToken(authUser);

    res.json({
      message: 'Login successful',
      token,
      user: authUser,
    });
  } catch (error) {
    const err = error as Error;
    console.error('Login error:', err);
    res.status(500).json({
      error: `Database connection error: ${err.message || 'Please ensure the database is reachable.'}`,
    });
  }
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});
