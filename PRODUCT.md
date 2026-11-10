# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Finance, Accounting & Audit Teams**: Internal analysts and auditors at Contemporain Foods Inc. (J.CO Donuts & Coffee Philippines) who reconcile daily store sales, inspect Report of Findings (ROF) discrepancies, monitor bank deposits (`Deposit Monitoring`), and audit POS guest checks and promotional discounts against `OracleDB`.
- **Operations, Marketing & Supply Chain Teams**: Area managers, marketing planners, and supply chain coordinators who track Theoretical Bill of Materials (`Theoretical BOM`) raw material requirements, evaluate campaign performance (`Promotions`), analyze product mix (`Menu Item`), and monitor store quota attainment (`Sales Target`).
- **Executive Leadership**: Company leaders reviewing multi-store KPIs, revenue velocity, promotional efficiency, and store network performance across Philippine store locations.

## Product Purpose

Oracle Reporting Tool Web is an internal LAN reporting and operational analytics platform for Contemporain Foods Inc. It transforms high-volume POS transaction records from Microsoft SQL Server (`OracleDB`, ~200 million rows in `dbo.dts_details`) into fast, auditable, decision-ready operational, financial, and supply chain reports. Success means internal teams can filter, compare, drill down into receipt-level transactions, and export audit-ready reports (Excel, CSV, PDF, and Print) without running manual SQL queries or risking direct database load.

## Positioning

A purpose-built, LAN-isolated operational intelligence portal wired directly to Contemporain Foods Inc.'s `OracleDB` POS schema (`dbo.dts_details` and `dts_location`), combining multi-level Theoretical BOM explosion, receipt-level promotional bundle drilldowns, store-by-store financial reconciliation (ROF and Deposit Monitoring), and instant multi-format audit exports in a single stateful workspace.

## Operating Context

- **Deployment & Network Environment**: Deployed internally on Synology Container Manager for LAN-only access by approximately 10–30 concurrent internal users.
- **Data Cadence & Scale**: Backed by Microsoft SQL Server (`OracleDB`) with daily data refreshes triggered by an operator. Interactive reports query validated server-side endpoints and stored procedures over ~200 million transaction rows (`dbo.dts_details`).
- **Multi-Report Operational Rituals**: Users frequently switch between active report modules (`Dashboard`, `Theoretical BOM`, `System Sales`, `Menu Item`, `Promotions`, `Sales Target`, `ROF`, and `Deposit Monitoring`) during reconciliation and planning sessions; visited report views remain mounted in-session so filters, drilldowns, and scroll positions are preserved.
- **Downstream Artifacts**: Reports regularly leave the browser as standardized `.xlsx` workbooks, `.csv` extracts, formatted PDFs (`jspdf` / `jspdf-autotable`), or printed physical audit sheets denominated in Philippine Pesos (`₱` / PHP).

## Capabilities and Constraints

- **Confirmed Active Modules**:
  - `Dashboard`: Cross-store executive and operational overview.
  - `Theoretical BOM`: Multi-level Bill of Materials explosion calculating theoretical raw material requirements from finished-good sales. Actual physical inventory consumption and usage variance are out of scope for the initial BOM release.
  - `System Sales`: Consolidated and per-store POS sales summaries.
  - `Menu Item`: SKU-level quantity, revenue, and category mix reporting.
  - `Promotions`: 3-tier campaign hierarchy with Promotion Plan Leaderboard, Pin-to-Compare Matrix (2–4 plans), store geography breakdown, daily/monthly velocity trends, and receipt-level zero-price bundle item drilldowns.
  - `Sales Target`: Store sales target vs. actual achievement tracking.
  - `ROF` (Report of Findings) & `Deposit Monitoring`: Financial audit and store deposit verification workflows.
- **Planned / Placeholder Modules** (currently disabled or placeholder routes):
  - `Finance Insight` (`finance-insight`)
  - `Hourly Sales` (`hourly-sales`)
  - `Tender Listing` (`tender-listing`)
- **Security & Architecture Constraints**:
  - Browser code never connects directly to SQL Server; all database credentials (`oracle_web_reporting`) reside strictly in server-side environment variables.
  - Queries must avoid unindexed full scans of `dbo.dts_details` during interactive requests.
  - Authentication maps to `dts_location` accounts with automatic client-side inactivity session timeout protection (`SessionTimeoutModal`).
  - Never commit `.env` files, database credentials, production transaction data, or exported financial reports.
- **Functional Parity Constraints**:
  - All financial figures use Philippine Peso (`₱`) formatting with tabular numeric alignment and explicit handling of zero-price bundled items vs. paid items.
  - New or updated reporting views must maintain parity across Light and Dark modes (`data-theme="light" | "dark"`) and support the established export pipeline (Excel, CSV, PDF, Print) where applicable.

## Brand Commitments

- **Identity**: Oracle Reporting Tool • Contemporain Foods Inc.
- **Brand Assets**: J.CO Donuts & Coffee emblem (`client/src/assets/jco-logo.png`).
- **Voice & Tone**: Clear, precise, operational, and audit-grade—prioritizing unambiguous financial and inventory terminology (`Guest Checks`, `Theoretical BOM`, `ROF`, `Store Reach`, `Bundled Zero-Price Items`) over marketing copy.

## Evidence on Hand

- Brand logo asset at `client/src/assets/jco-logo.png`.
- Architecture and operational documentation in `README.md`, `docs/ARCHITECTURE.md`, and `docs/DEVELOPMENT.md`.
- Production-aligned report implementations and export utilities under `client/src/features/` (`bom`, `promotions`, `systemsales`, `menuitem`, `salestarget`, `rof`, `deposit`, `auth`) and `server/src/`.
- No external marketing testimonials, public pricing tiers, or customer case studies exist or apply (internal enterprise tool—do not fabricate public marketing proof).

## Product Principles

1. **Audit-Grade Accuracy First**: Every total, share percentage, average unit value, and receipt drilldown must reconcile deterministically with `OracleDB` POS records and exported Excel/PDF artifacts.
2. **Comparison Without Context Loss**: Analysts should be able to rank, pin, sort, and inspect store or receipt details side-by-side without losing their filter state, scroll position, or active report context.
3. **High-Signal Operational Scannability**: Surface primary decision drivers (campaign leaderboards, store variances, BOM requirements) above the fold before secondary breakdowns, supporting both rapid executive scanning and deep row-level auditing.
4. **LAN Performance & Query Safety**: Respect the ~200M-row `dbo.dts_details` boundary by scoping interactive queries through validated parameters, caching drilldown responses in-memory per session, and preventing redundant heavy queries.
