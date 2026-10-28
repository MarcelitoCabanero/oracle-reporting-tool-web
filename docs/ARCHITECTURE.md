# Architecture and implementation order

## Runtime boundaries
- `client/`: presentation, route navigation, filters, tables, and export interactions.
- `server/`: API routes, input validation, authorization, business logic, and database access.
- `database/`: versioned SQL scripts and query notes.
- `deploy/`: container and Synology deployment files.

## Recommended implementation sequence
1. Establish the repo and local developer workflow.
2. Verify frontend shell and API health endpoint.
3. Add server-only SQL Server connectivity and verify a lightweight query.
4. Review authentication and password migration from `dts_location`.
5. Implement Theoretical BOM Requirements with single/all finished-good filters.
6. Validate multi-level BOM math and data-quality warnings.
7. Add export, role-based access, and production deployment hardening.

## Database context
- Database: `OracleDB`
- Primary transaction source: `dbo.dts_details`, approximately 200 million rows
- Dedicated reporting login: `oracle_web_reporting`
- Freshness: daily, after an operator triggers the data refresh
- Concurrency target: approximately 10–30 internal LAN users

The UI must not connect directly to SQL Server. Avoid full scans of `dts_details` on interactive requests; use validated stored procedures and/or precomputed summaries where appropriate.
