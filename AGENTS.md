# Oracle Reporting Tool Web — Project Rules

## Ponytail Configuration
Default Ponytail intensity mode: full

## Architecture & Security Guardrails (Never Skip)
- **Strict Client/Server Boundary:** Browser code (`client/`) must NEVER connect directly to SQL Server. All database queries belong strictly in `server/`.
- **Credential Safety:** SQL Server credentials must only be read from server-side environment variables. Never hardcode secrets or commit `.env` files, production data, or exports.
- **SQL & Data Integrity:** Always use parameterized queries for SQL Server (`OracleDB`) inputs. Never strip input validation or error handling on API routes.
- **Auth & Network Scope:** Keep deployment LAN-only. Do not implement or enable login flows until `dts_location` password verification/migration is explicitly designed.

## Current Milestone Scope
- Focus strictly on **Theoretical BOM Requirements**.
- Treat actual consumption and usage variance as **out of scope**—do not build speculative tables, endpoints, or UI placeholders for them.

## Skill Coexistence
- Preserve existing `.agent/skills/impeccable` UI/design conventions when editing `client/` components; apply Ponytail minimalism to avoid unnecessary third-party libraries and duplicate components.
