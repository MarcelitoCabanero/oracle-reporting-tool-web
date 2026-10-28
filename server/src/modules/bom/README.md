# Theoretical BOM Requirements — planned

First reporting feature after the foundation is tested.

Filters:
- Business date
- Store/location
- One finished good or all finished goods

Outputs:
- Consolidated theoretical raw-material requirements, grouped by raw material and inventory UOM
- Traceable finished-good → subassembly → component calculation path
- Validation warnings for missing BOMs, inactive/ambiguous formula mappings, zero denominators/conversions, and possible cycles

Business rule confirmed so far:
- Level 1: `((QtyNeeds / QtyDenominator) * QtySold) / UnitConversion`
- Deeper levels must cascade the immediate parent's required quantity through each recipe level. Validate each level against hand-calculated examples before replacing or modifying the existing stored procedure.

Actual consumption and usage variance are not part of this initial BOM scope.
