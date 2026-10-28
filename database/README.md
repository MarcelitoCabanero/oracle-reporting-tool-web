# Database scripts

Keep schema changes and stored-procedure changes in numbered, reviewed SQL files (for example `001_add_reporting_indexes.sql`). Do not store production credentials, transaction exports, or unredacted sensitive data here.

Existing SQL Server reporting behavior is the source of truth. Do not alter the current BOM procedure until multi-level calculations are validated.
