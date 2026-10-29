import { Router } from 'express';
import { getPool, sql } from '../../database/db.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const bomRouter = Router();

// Protect all BOM & metadata endpoints with requireAuth
bomRouter.use(requireAuth);

/**
 * GET /api/reports/bom/stores
 * Returns all active stores/locations for the filter dropdown
 */
bomRouter.get('/stores', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT DISTINCT LOCATIONID, LOCATIONNAME, ORGLOCATIONREF
      FROM dbo.dts_location
      WHERE IsActive = 1 AND access = 'Store'
      ORDER BY LOCATIONNAME ASC
    `);

    res.json({ stores: result.recordset });
  } catch (error) {
    console.error('Error fetching active stores:', error);
    res.status(500).json({ error: 'Failed to retrieve store locations from database.' });
  }
});

/**
 * GET /api/reports/bom/finished-goods?search=...
 * Autocomplete / searchable catalog for Finished Goods from tbl_bom_header
 */
bomRouter.get('/finished-goods', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('search', sql.NVarChar(100), `%${search}%`);

    const query = `
      SELECT DISTINCT TOP 50 
        FormulaCode, 
        FGItemCode, 
        FGName
      FROM dbo.tbl_bom_header
      WHERE IsActive = 1
        ${search ? "AND (FGName LIKE @search OR FGItemCode LIKE @search OR FormulaCode LIKE @search)" : ""}
      ORDER BY FGName ASC
    `;

    const result = await request.query(query);
    res.json({ finishedGoods: result.recordset });
  } catch (error) {
    console.error('Error fetching finished goods:', error);
    res.status(500).json({ error: 'Failed to retrieve finished goods from database.' });
  }
});

/**
 * POST /api/reports/bom/calculate
 * Executes usp_CalculateBOMRequirements with location, date range, and optional FG filter
 */
bomRouter.post('/calculate', async (req, res) => {
  const { locationName, startDate, endDate, fgItemCode } = req.body ?? {};

  if (!locationName || typeof locationName !== 'string') {
    res.status(400).json({ error: 'Store / Location name is required.' });
    return;
  }

  if (!startDate || !endDate) {
    res.status(400).json({ error: 'Start Date and End Date are required.' });
    return;
  }

  try {
    const pool = await getPool();
    const request = pool.request();

    request.input('LocationName', sql.VarChar(50), locationName.trim());
    request.input('StartDate', sql.Date, startDate);
    request.input('EndDate', sql.Date, endDate);
    request.input('FGItemCode', sql.VarChar(50), fgItemCode ? String(fgItemCode).trim() : null);

    const result = await request.execute('dbo.usp_CalculateBOMRequirements');

    const recordsets = Array.isArray(result.recordsets)
      ? (result.recordsets as sql.IRecordSet<any>[])
      : [];

    let breakdown: any[] = [];
    let consolidated: any[] = [];

    if (recordsets.length >= 2) {
      breakdown = recordsets[0] ?? [];
      consolidated = recordsets[1] ?? [];
    } else if (recordsets.length === 1) {
      // Gracefully handle older stored procedure version with single result set
      consolidated = recordsets[0] ?? [];
    }

    res.json({
      filters: {
        locationName,
        startDate,
        endDate,
        fgItemCode: fgItemCode || null,
      },
      summary: {
        consolidatedItemCount: consolidated.length,
        breakdownItemCount: breakdown.length,
        generatedAt: new Date().toISOString(),
      },
      consolidated,
      breakdown,
    });
  } catch (error) {
    console.error('Error executing BOM calculation:', error);
    res.status(500).json({
      error: `Failed to calculate BOM requirements: ${(error as Error).message}`,
    });
  }
});
