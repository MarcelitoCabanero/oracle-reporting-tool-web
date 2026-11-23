# Oracle Reporting Tool Web

Internal LAN reporting, financial reconciliation, and operational analytics platform for **Contemporain Foods Inc.** (J.CO Donuts & Coffee Philippines), powered by Microsoft SQL Server (`OracleDB`).

---

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite, Bootstrap 5, Lucide Icons, Recharts
- **Export & Print Pipeline:** SheetJS (`xlsx`), CSV, `jsPDF` + `jspdf-autotable`, `html2canvas`, Print stylesheets
- **Backend API:** Node.js 22, TypeScript, Express, `mssql` (Tedious), JWT (`jsonwebtoken`), `basic-ftp`
- **Database:** Microsoft SQL Server (`OracleDB` — `dbo.dts_details` ~200M rows, `dbo.dts_location`, `dbo.FCR_INVOICE_DATA`, `dbo.dts_depo`, and reporting aggregate tables)
- **Container & Hosting:** Multi-stage Docker (`node:22-alpine`), Docker Compose, hosted on **Synology Container Manager (NAS)** with optional DSM Nginx Reverse Proxy (HTTPS/SSL)

---

## Current Milestone & Completed Features

The project has progressed from initial repository scaffolding to a **production-deployed, multi-module operational & financial reporting suite** running in Docker on the company LAN.

### 1. Authentication, Role-Based Access Control (RBAC) & Session Security
- **Identity Source:** Authenticates against existing `dbo.dts_location` accounts using JWT bearer tokens.
- **Role-Scoped Store Access (`enforceStoreScope`):**
  - **Full-Store Roles (`Operation Manager`, `Executive`, `Admin`, `Department`):** Unrestricted visibility across all active store locations (`ALL`).
  - **Scoped Roles (`Area Manager`, `Store`):** Automatically filtered to only their assigned stores (`AreaManagerID = LOCATIONID` or own store).
- **Session Hygiene:** Automatic client-side inactivity timeout modal (`SessionTimeoutModal`), thorough `sessionStorage` cleanup on logout, and persistent light/dark mode (`data-theme="light" | "dark"`).
- **Stateful Workspace Navigation:** Visited report modules stay mounted in-session (`App.tsx`) to preserve active filters, drilldown states, and scroll positions when switching tabs, backed by a searchable `StoreSearchSelect` component.

### 2. Active Dashboard & Reporting Modules

| Section | Module | Route / API | Capabilities & Done Items |
| :--- | :--- | :--- | :--- |
| **Dashboard** | **Executive Dashboard** | `dashboard` | Cross-store operational overview and quick module launcher. |
| **Dashboard** | **Finance Insight** | `finance-insight`<br>`/api/reports/finance-insight` | Executive financial analytics powered by pre-aggregated daily tables (`dbo.agg_daily_dsr`, `dbo.agg_daily_revenuecenter`, `dbo.agg_daily_checkcount`). Tracks Net Sales, Guest Count, Check Count, Average Check, YoY/PoP Growth panels, and Revenue Center mix. |
| **Reports** | **Theoretical BOM** | `bom`<br>`/api/reports/bom` | Multi-level Bill of Materials explosion (`dbo.usp_CalculateBOMRequirements`) calculating theoretical raw material requirements from finished-good POS sales, with finished-good search and Excel/CSV/PDF/Print exports. *(Actual physical inventory & usage variance remain out of scope for initial release).* |
| **Reports** | **System Sales Summary** | `system-sales`<br>`/api/reports/system-sales` | Consolidated and store-level POS sales reconciliation, including a dedicated **Void & Cancelled Items Summary** (`VoidSummaryReport`) and full Excel/PDF export utilities. |
| **Reports** | **Menu Item Sales** | `menu-item`<br>`/api/reports/menu-item` | SKU-level quantity sold, net sales, and category product mix analytics with multi-format exports. |
| **Reports** | **Promotions Analytics** | `promotions`<br>`/api/reports/promotions` | 3-tier promotional campaign hierarchy featuring a Promotion Plan Leaderboard, **Pin-to-Compare Matrix** (compare 2–4 plans side-by-side), store geography reach, daily/monthly velocity trends, receipt-level zero-price bundle item drilldowns, and Excel/PDF exports. |
| **Reports** | **Sales Target** | `sales-target`<br>`/api/reports/sales-target` | Store quota planning and Target vs. Actual achievement analytics (`dbo.usp_SuggestSalesTarget`, `dbo.usp_GetSalesTargetAnalytics`). Includes **batch generation & saving for all active stores**, Weekday vs. Weekend/Holiday split %, Category Mix %, CRUD management for categories/stores/calendar holidays, and session state persistence. |
| **Finance** | **ROF (Remittance of Funds)** | `rof`<br>`/api/reports/rof` | Store-by-store financial remittance and discrepancy auditing with accessible workspace tab navigation and multi-format export support. |
| **Finance** | **Deposit Monitoring** | `deposit`<br>`/api/reports/deposit` | Store bank deposit verification with **FTP deposit slip attachment streaming**, Area Manager approval workflows, Petty Cash / Open Sales / Dept Expense deduction backtracking, discussion threads (`dbo.dts_depo_threads`, `dbo.dts_depo_attachments`), delete request approvals, and real-time sidebar pending-approval notification badges (`DepositNotificationContext`). |

### 3. Planned / Upcoming Modules
- **Hourly Sales (`hourly-sales`):** Hourly store sales breakdown and peak performance analytics (currently placeholder/disabled in sidebar).
- **Tender Listing (`tender-listing`):** Payment tender methods, credit/debit collections, and cash reconciliation (currently placeholder).

---

## Database Migrations & Scripts (`database/`)

Numbered SQL scripts in [`database/`](database/README.md) must be executed in order against `OracleDB`:
1. [`001_update_usp_CalculateBOMRequirements.sql`](database/001_update_usp_CalculateBOMRequirements.sql) — Multi-level Theoretical BOM calculation procedure.
2. [`002_create_sales_target_schema.sql`](database/002_create_sales_target_schema.sql) — Sales Target tables (`tbl_sales_target_category`, `tbl_sales_target_category_map`, `tbl_sales_calendar_holiday`, `tbl_sales_target_header`, `tbl_sales_target_monthly`, `tbl_sales_target_category_mix`) and view `vw_sales_target_detailed`.
3. [`003_usp_SuggestSalesTarget.sql`](database/003_usp_SuggestSalesTarget.sql) — Quarterly target suggestion procedure based on YoY trends and Basis Month ADS.
4. [`004_usp_GetSalesTargetAnalytics.sql`](database/004_usp_GetSalesTargetAnalytics.sql) — Target vs. Actual sales, quantity (PCS/BOXES), customer count, average check, and YoY growth analytics.
5. [`005_add_area_manager_to_location.sql`](database/005_add_area_manager_to_location.sql) — Adds `AreaManagerID` mapping to `dbo.dts_location` for role-scoped store filtering.
6. [`005_deposit_monitoring_approvals_threads.sql`](database/005_deposit_monitoring_approvals_threads.sql) — Adds approval, deduction backtracking, and delete request columns to `dbo.dts_depo`, plus `dbo.dts_depo_threads` and `dbo.dts_depo_attachments`.
7. [`006_finance_insight_aggregates.sql`](database/006_finance_insight_aggregates.sql) — Creates `dbo.agg_daily_revenuecenter` and `dbo.agg_daily_checkcount` along with nightly reload procedures (`usp_Load_agg_daily_revenuecenter`, `usp_Load_agg_daily_checkcount`).

---

## Docker Deployment & Synology NAS Hosting

The application is packaged as a single unified container (`oracle-reporting-web`) using a multi-stage [`Dockerfile`](Dockerfile) (`node:22-alpine`) and [`docker-compose.yml`](docker-compose.yml).

### Container Architecture
- **Stage 1 (`builder`):** Installs npm workspace dependencies (`client` and `server`), compiles TypeScript and the Vite React bundle, and prunes devDependencies.
- **Stage 2 (`runner`):** Runs a lightweight `node:22-alpine` production server (` TZ=Asia/Manila`) on port **`3001`**.
- **Same-Origin Delivery:** The Express server (`server/dist/server.js`) serves both the `/api/*` endpoints and the compiled React SPA (`client/dist`) from the same origin on port `3001`, eliminating CORS issues across LAN IPs.
- **Built-in Health Check:** Docker periodically probes `http://127.0.0.1:3001/api/health`.

### Hosting on Synology Container Manager (LAN)
Full step-by-step instructions are maintained in [`deploy/README.md`](deploy/README.md):

1. **Project Directory on NAS:** `/volume1/docker/oracle-reporting-tool-web`
2. **Environment Configuration:** Create `/volume1/docker/oracle-reporting-tool-web/.env` with production server, JWT, SQL Server (`OracleDB`), and FTP credentials (see [`.env.example`](.env.example)).
3. **Initial Deployment (DSM GUI):**
   - In Synology **Container Manager** → **Project** → **Create**, point to `/docker/oracle-reporting-tool-web` and select **Use existing `docker-compose.yml`**.
4. **Automated One-Command Updates (SSH):**
   Run [`deploy/update.sh`](deploy/update.sh) on the Synology host:
   ```bash
   cd /volume1/docker/oracle-reporting-tool-web
   sudo sh deploy/update.sh
   ```
   The script pulls the latest `main` branch (using a fallback `alpine/git` container if `git` is not installed on DSM), rebuilds and restarts the container (`docker compose up -d --build`), prunes dangling image layers (`docker image prune -f`), and verifies `http://localhost:3001/api/health` returns `HTTP 200`.
5. **LAN & HTTPS Access:**
   - **Direct LAN HTTP:** `http://<SYNOLOGY_NAS_IP>:3001`
   - **HTTPS / SSL Reverse Proxy:** Configure Synology DSM **Control Panel → Login Portal → Advanced → Reverse Proxy** to terminate HTTPS (port `443` or `3443` with Let's Encrypt or company certificate) and proxy traffic to `http://localhost:3001`.

---

## Local Development

See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for local setup details.

```bash
# 1. Copy environment template and configure local credentials
cp .env.example .env

# 2. Install workspace dependencies
npm install

# 3. Run API (port 3001) and Vite Web UI (port 5173) concurrently
npm run dev

# 4. Type-check and build both workspaces
npm run check
```

---

## Architecture & Security Rules
- **No Direct Browser-to-DB Connections:** Browser code never connects directly to SQL Server; all database and FTP credentials reside strictly in server-side environment variables.
- **Secret Hygiene:** Never commit `.env` files, database/FTP passwords, production transaction rows, or exported reports to Git.
- **Query Safety on ~200M Rows:** Avoid unindexed full scans of `dbo.dts_details` on interactive requests; use date/store-scoped queries, stored procedures, and daily pre-aggregated tables (`agg_daily_*`).
- **Network Isolation:** Keep deployment restricted to the internal company LAN unless network exposure and security controls are formally reviewed.
