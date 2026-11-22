import type { NextFunction, Response } from 'express';
import { getPool, sql } from '../../database/db.js';
import type { AuthenticatedRequest } from './auth.middleware.js';
import type { AuthUser } from './token.service.js';

export interface StoreRow {
  LOCATIONID: number;
  LOCATIONNAME: string;
  ORGLOCATIONREF: string;
}

/** Roles that can see every active store. Any other role is limited to assigned stores. */
const ALL_STORE_ROLES = new Set(['operation manager', 'executive', 'admin']);

const ALL_TOKENS = new Set(['ALL', 'ALL_PENDING']);

export function hasAllStoreAccess(user: AuthUser | undefined): boolean {
  return ALL_STORE_ROLES.has((user?.access ?? '').trim().toLowerCase());
}

/**
 * Stores visible to the user.
 * - Operation Manager / Executive / admin: all active stores.
 * - Area Manager: active stores whose AreaManagerID = the user's LOCATIONID (from the JWT).
 */
export async function getScopedStores(user: AuthUser): Promise<StoreRow[]> {
  const pool = await getPool();
  const request = pool.request();
  let scopeSql = '';
  if (!hasAllStoreAccess(user)) {
    request.input('areaManagerId', sql.Int, user.locationId);
    scopeSql = 'AND AreaManagerID = @areaManagerId';
  }
  const result = await request.query(`
    SELECT DISTINCT LOCATIONID, LOCATIONNAME, ORGLOCATIONREF
    FROM dbo.dts_location
    WHERE IsActive = 1 AND access = 'Store' ${scopeSql}
    ORDER BY LOCATIONNAME ASC
  `);
  return result.recordset as StoreRow[];
}

/** Allowed store names, or null when the user may see all stores. */
export async function getAllowedStoreNames(user: AuthUser): Promise<string[] | null> {
  if (hasAllStoreAccess(user)) return null;
  const stores = await getScopedStores(user);
  return stores.map((s) => String(s.LOCATIONNAME).trim());
}

export function isAllToken(value: unknown): boolean {
  return typeof value === 'string' && ALL_TOKENS.has(value.trim().toUpperCase());
}

export function isStoreAllowed(allowed: string[] | null | undefined, name: string): boolean {
  if (!allowed) return true;
  const target = name.trim().toLowerCase();
  return allowed.some((n) => n.trim().toLowerCase() === target);
}

/**
 * Adds `AND <column> IN (@scopeStore0, ...)` for scoped users.
 * Returns '' for full-access users; returns 'AND 1 = 0' when a scoped user has no stores.
 */
export function allowedStoresSql(
  request: sql.Request,
  allowed: string[] | null | undefined,
  column: string,
): string {
  if (!allowed) return '';
  if (allowed.length === 0) return 'AND 1 = 0';
  const params = allowed.map((name, i) => {
    request.input(`scopeStore${i}`, sql.VarChar(100), name);
    return `@scopeStore${i}`;
  });
  return `AND ${column} IN (${params.join(',')})`;
}

/**
 * Router-level guard (use after requireAuth). Resolves the user's allowed stores onto
 * `req.allowedStoreNames` (undefined = all stores) and rejects requests whose
 * `locationName` names a store outside that scope. 'ALL' values are passed through;
 * handlers that support them must narrow the query with `allowedStoresSql`.
 */
export async function enforceStoreScope(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }
  if (hasAllStoreAccess(user)) {
    next();
    return;
  }

  try {
    const allowed = (await getAllowedStoreNames(user)) ?? [];
    req.allowedStoreNames = allowed;

    const raw = (req.body && req.body.locationName) ?? req.query?.locationName;
    if (typeof raw === 'string' && raw.trim() && !isAllToken(raw) && !isStoreAllowed(allowed, raw)) {
      res.status(403).json({ error: 'You do not have access to this store.' });
      return;
    }
    next();
  } catch (error) {
    console.error('Store scope resolution failed:', error);
    res.status(500).json({ error: 'Failed to resolve store access.' });
  }
}
