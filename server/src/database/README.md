# Database access boundary

SQL Server connectivity will be implemented here in a later foundation step.

Rules:
- Read connection details from server-side environment variables.
- Use the dedicated `oracle_web_reporting` SQL login, not `sa`.
- Grant only the required OracleDB view/stored-procedure permissions.
- Prefer parameterized queries and stored procedures.
- Never return connection strings or credentials from API endpoints.
- Do not run unbounded queries against `dbo.dts_details` (~200M rows) from interactive report requests.
- Validate recursive BOM calculations against the existing procedure and representative test cases before changing business logic.
