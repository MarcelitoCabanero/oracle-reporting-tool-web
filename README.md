# Oracle Reporting Tool Web

Internal LAN reporting dashboard for OracleDB.

## Stack
- Frontend: React + TypeScript + Vite
- API: Node.js + TypeScript + Express
- Database: Microsoft SQL Server (`OracleDB`)
- Deployment target: Synology Container Manager (LAN-only)

## Current milestone
Repository foundation. The first reporting feature is Theoretical BOM Requirements. Actual consumption and usage variance are out of scope for the initial BOM release.

## Architecture rules
- Browser code never connects directly to SQL Server.
- SQL Server credentials are server-side environment variables only.
- Do not commit `.env` files, credentials, production data, or exports.
- Existing `dts_location` accounts are the intended identity source; production password verification/migration must be designed before login is enabled.
- Keep deployment LAN-only unless network exposure and security are reviewed.

## Getting started
See [Development guide](docs/DEVELOPMENT.md) and [Architecture](docs/ARCHITECTURE.md).
