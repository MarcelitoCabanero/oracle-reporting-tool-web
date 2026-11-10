# Database scripts

Keep schema changes and stored-procedure changes in numbered, reviewed SQL files (for example `001_add_reporting_indexes.sql`). Do not store production credentials, transaction exports, or unredacted sensitive data here.

Existing SQL Server reporting behavior is the source of truth. Do not alter the current BOM procedure until multi-level calculations are validated.

## Sales Target Module Scripts

Execute in order against `OracleDB`:
1. `002_create_sales_target_schema.sql` — Creates the Sales Target tables (`dbo.tbl_sales_target_category`, `dbo.tbl_sales_target_category_map`, `dbo.tbl_sales_calendar_holiday`, `dbo.tbl_sales_target_header`, `dbo.tbl_sales_target_monthly`, `dbo.tbl_sales_target_category_mix`) and computed view `dbo.vw_sales_target_detailed`.
2. `003_usp_SuggestSalesTarget.sql` — Creates `dbo.usp_SuggestSalesTarget` for quarterly target suggestions based on Same Quarter Last Year (YoY trend) and Basis Month ADS, plus historical Weekday vs. Weekend/HD split % and Category Mix %.
3. `004_usp_GetSalesTargetAnalytics.sql` — Creates `dbo.usp_GetSalesTargetAnalytics` for Target vs. Actual (Sales PHP & Qty PCS/BOXES), Weekday vs. Weekend/HD, Customer Count / Average Check, and YoY growth analytics.
