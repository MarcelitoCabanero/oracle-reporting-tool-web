# Oracle Reporting Tool Web — Project Rules

## Ponytail Configuration
Default Ponytail intensity mode: full

## Critical Architecture & Security Guardrails (Never Skip)
- **Strict Client/Server Boundary:** Browser code (`client/`) must NEVER connect directly to SQL Server or FTP. All `mssql` (Tedious) and `basic-ftp` operations belong strictly in `server/`.
- **Credential & Data Hygiene:** Read SQL Server, JWT, and FTP credentials strictly from server-side environment variables. Never hardcode secrets or commit `.env` files, database/FTP passwords, production transaction rows, or exported files.
- **RBAC & Store Scoping:** Every reporting and mutation endpoint in `server/` must enforce JWT authentication and `enforceStoreScope` so `Area Manager` and `Store` roles never access unauthorized store data.
- **200M-Row Query Safety (`dbo.dts_details`):** Never write unindexed full-table scans against `dbo.dts_details` (~200M rows) for interactive requests. Always filter by indexed date/store ranges, call existing stored procedures (`usp_*`), or query daily pre-aggregated tables (`agg_daily_*`).

## Existing Patterns & Reuse First (Ponytail Ladder)
- **Database Migrations:** Place any new schema or stored procedure changes in `database/` following the sequential numbering convention (`007_*.sql` onward) and keep scripts idempotent.
- **UI & Export Reuse:** Reuse existing workspace components (`StoreSearchSelect`, `SessionTimeoutModal`, Bootstrap 5 + `data-theme` variables) and existing export utilities (`xlsx`, `jsPDF`, `html2canvas`) instead of adding new UI or export libraries.
- **Stateful Tabs:** Preserve `App.tsx` mounted-tab state behavior when adding or updating report views so filters and scroll positions persist across tab switches.

## Scope Boundaries
- **In Scope:** Production maintenance and enhancements across active modules (`finance-insight`, `bom`, `system-sales`, `menu-item`, `promotions`, `sales-target`, `rof`, `deposit`).
- **Out of Scope / Deferred:** Do not build actual physical inventory / usage variance into `bom`, and do not implement `hourly-sales` or `tender-listing` unless explicitly requested.

## Verification & Skill Coexistence
- Run `npm run check` to verify TypeScript compilation and builds across both `client` and `server` workspaces after changes.
- Respect `.agent/skills/impeccable` UI conventions when styling `client/` components while keeping component logic minimal.
