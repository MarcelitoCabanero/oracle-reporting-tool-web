# Authentication module — planned

The intended identity source is the existing `dbo.dts_location` table. Production login is deliberately not implemented in the foundation scaffold.

Before enabling authentication:
1. Confirm how current application passwords are stored and verified.
2. Design a secure password-hash migration/verification path; do not copy plaintext password practices into the web app.
3. Enforce `IsActive` and handle null username/password rows.
4. Add server-side session/token handling, rate limiting, audit logging, and authorization checks.
5. Define role-to-store and role-to-report mappings with business approval.
