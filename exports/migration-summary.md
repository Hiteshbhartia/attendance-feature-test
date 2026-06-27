# Legacy HRMS Workforce Export — Migration Summary

**Generated:** 2026-06-01 11:22:52 UTC
**Source:** `gharpayy-attendance.gpattusers` (via mongosh read-only extraction)
**Status:** ✅ READ-ONLY — no data modified

> ⚠️ Awaiting HR verification and approval before migration.

## Counts

| Metric | Count |
|---|---|
| Total employees | **53** |
| Active | 49 |
| Inactive / other | 4 |
| Status blank | 0 |
| Zones (reference) | 6 |
| Teams (reference) | 3 |
| Hierarchy roles | 5 |

## Operational Role Breakdown

| Role | Count |
|---|---|
| employee | 49 |
| manager | 4 |

## Application Role Breakdown

| App Role | Count |
|---|---|
| employee | 53 |

## Zone Breakdown

| Zone | Count |
|---|---|
| (no zone) | 47 |
| KORA CORE | 3 |
| HOMES Kora | 1 |
| MWB MORE | 1 |
| MTECH HUB | 1 |

## Manager Breakdown

| Manager | Direct Reports |
|---|---|

## Hierarchy Roles (from gp_hierarchy_roles)

| Name | Level | System Role | Can Manage Team |
|---|---|---|---|
| Manager | 4 | manager | false |
| Employee | 4 | employee | false |
| HR | 4 | hr | false |
| Team Lead | 4 | team_lead | false |
| Admin | 4 | admin | false |

## Data Quality Issues

| Issue | Count |
|---|---|
| Missing email | 0 |
| Missing manager | 53 |
| Missing zone | 47 |
| Missing name | 0 |
| Duplicate emails | 0 |
| Duplicate employee IDs | 0 |

## Sample Records (first 10)

| # | Name | Email | Role | App Role | Zone | Manager | Status |
|---|---|---|---|---|---|---|---|
| 1 | Ammar Logade | ammar.gharpayy@gmail.com | employee | employee | — | — | active |
| 2 | Nilesh | nilesh@gharpayy.in | employee | employee | — | — | active |
| 3 | Pulkit Jain | pulkit.gharpayy@gmail.com | employee | employee | — | — | active |
| 4 | Satvik Sharma | satvik.gharpayy@gmail.com | employee | employee | — | — | active |
| 5 | Abhay Sharma | abhaysharmaa5858@gmail.com | employee | employee | — | — | active |
| 6 | Sangeetha G | sangeetha.gharpayy@gmail.com | employee | employee | — | — | active |
| 7 | Laimayum Tania Sharma | tania.gharpayy@gmail.com | employee | employee | — | — | active |
| 8 | vandan jain | bohravandan7@gmail.com | employee | employee | — | — | active |
| 9 | M.N.Nidhi | mnnidhi2006@gmail.com | employee | employee | — | — | active |
| 10 | Naveen Dhawan | naveendhawan.gharpayy@gmail.com | employee | employee | — | — | active |

## Output Files

| File | Path |
|---|---|
| CSV  | `exports/legacy-employees.csv` |
| XLSX | `exports/legacy-employees.xlsx` |
| Summary | `exports/migration-summary.md` |

---

> **Next step:** HR team reviews and approves this export before any migration is executed.
> No data has been written, modified, or deleted in any database.