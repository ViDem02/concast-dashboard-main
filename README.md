# Concast Energy Dashboard

This site shows how Concast turns raw energy workbooks into clear decisions. Everything here is designed for a non‑technical jury: what data we ingest, how we process it, and what you can learn from the visual stories.

## What you see
- Daily operations: demand, cogeneration, grid purchases, CO₂, and savings (real data, hour by hour).
- MILP optimization: how the solver picks the best hourly mix and the benefits it unlocks.
- Scenario 2026: a forward look that combines history, solar potential, and market price futures.

## From XLSM to JSON (data pipeline)

| Stage | What happens | Evidence in repo |
| --- | --- | --- |
| Source | Hourly XLSM files: demand, gas/PUN prices, setpoints (per year and scenario). | `data-pipeline/<year>/<scenario>/*.xlsm` |
| Clean | Python scripts normalize headers, fix formats, and validate hours. | `data-pipeline/*/*.py` |
| Shape | Data is reorganized into year → month → day → hour JSON files. | `*_estratti_<year>.json` |
| Serve | The dashboard reads JSON directly to draw charts; no manual edits. | `apps/dashboard/data/` |

Key takeaway: every chart can be traced back to an exact XLSM source and processing script.

## MILP results at a glance

| Item | Description | Where it lives |
| --- | --- | --- |
| Inputs | Hourly demand, setpoints, gas costs, PUN prices. | `risultati milp/<year>/<horizon>/input*.csv` |
| Solver | Mixed Integer Linear Program ensures balance (demand = grid + coge), respects setpoints, and minimizes total cost. | Solver logs in `report.txt` |
| Outputs | Optimized CSVs with the best grid vs coge dispatch and KPIs (coverage, savings, optimized hours). | `risultati milp/<year>/<horizon>/risultato_ottimizzazione.csv` |

On `milp.html` you see: coverage of internal production, savings vs baseline, demand served by grid vs cogeneration, and row counts, with views by hour/day/week/month.

## Scenario 2026 (forecast view)

| Piece | Source | What you see |
| --- | --- | --- |
| Baseline demand | Historical averages from 2024–2025 “Normal” data. | Monthly indicators and mix (grid vs coge). |
| Solar (FV12) | Optimized FV12 profile added to the baseline. | Added production and CO₂ avoided. |
| Prices | Three PUN/PSV 2026 scenarios applied to the energy mix. | Cost bands and sensitivity. |
| Guidance | Fixed cogeneration mode suggested per month/week. | Clear “best mode” labels and savings deltas. |

The page translates CO₂ savings into simple comparisons and keeps the language plain for quick reading.

## How to explore
- `index.html`: overall KPIs and quick health of the plant.  
- `stats.html`: detailed electric statistics.  
- `forecast.html`: Scenario 2026 with solar and price assumptions.  
- `milp.html`: optimization pipeline and KPI snapshots from solver outputs.  
- Data sources live in `data-pipeline/` (XLSM → JSON) and `risultati milp/` (solver CSVs).

## Why it matters
- Transparency: every chart is linked to an auditable source file.  
- Optimization proof: MILP shows the economic upside of smarter dispatch.  
- Future readiness: Scenario 2026 anticipates solar and market shifts, highlighting savings and CO₂ cuts with simple language.  
- Decision speed: a single site merges history, optimization, and forward guidance for quick executive reviews.
