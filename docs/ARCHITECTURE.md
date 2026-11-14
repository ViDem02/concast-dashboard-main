# Architecture & Folder Strategy

This document describes how the repository is organized after the cleanup, along with the workflows that bind the Python data tools and the web dashboards.

## 1. Top-Level Layout

| Path | Purpose |
| --- | --- |
| `apps/dashboard` | Production-grade static site (HTML + CSS + vanilla JS). Ships KPI dashboards, stats view, and forecasting detail page. |
| `apps/prototypes` | Experimental sandboxes used to test ideas before they are ready for production. Keep dependencies and experimental scripts isolated here. |
| `data-pipeline/<year>/<scenario>` | Data extraction entry points. Each folder bundles the XLSM workbook, the Python scripts, and the exported JSON artefacts for a year/scenario pair. |
| `services/forecasting` | Python utilities that run outside of the core extraction flow (forecast builders, CSV generators, PUN estimators). |
| `services/timesfm_service` | Reserved space for the TimesFM wrapper/microservice (currently a scaffold). |
| `docs/` | Project-wide documentation (this file, design guidelines, AI instructions, deployment guides, etc.). |

## 2. Data Pipeline

1. **Source** – XLSM workbooks (`Coge spento weekend 20XX.xlsm`, other variants) live inside `data-pipeline/<year>/<scenario>/`.
2. **Extraction Scripts** – Run the Python helpers (`inserimento_consumi.py`, `inserimneto_prezzi.py`, `elaborazione_consumi.py`, `estrai_recap_costi.py`, `recap_consumi_csv.py`) in place. Each script normalizes headers, builds a nested `{year→month→day→hour}` dict, and dumps JSON (suffix `_estratti_<year>.json`).
3. **Post-processing** – Optional CSV builders inside `services/forecasting/` use those JSON/CSV outputs to compute derived aggregates (`generate_monthly_consumption_csv.py`, `estimate_pun_from_psv.py`, `build_2026_forecast.py`).
4. **Delivery** – Copy the generated JSON files into `apps/dashboard/data/` (or expose via HTTP if automated). The dashboard fetches them at runtime through `dataLoader.js`.

### Naming/Versioning Rules

- Name JSON outputs with both the source sheet and year to avoid collisions (e.g., `inserimento_consumi_estratti_2025.json`).
- Keep workbook-specific tweaks scoped to a scenario folder; do not mix macros or patched spreadsheets in the root year directory.
- Always document workbook deltas inside a `README.md` placed next to the scripts (see `data-pipeline/2025/normal/README.md` for template once created).

## 3. Front-End Dashboard (`apps/dashboard`)

- **Entry Points**: `index.html` (main), `forecast.html`, `stats.html`.
- **Data**: All JSON consumed via fetch – no bundlers, so file paths are relative to `/data`.
- **Modules**:
  - `js/config.js` – static constants (plant parameters, KPI thresholds).
  - `js/dataLoader.js` – fetch utilities for JSON/CSV.
  - `js/dataProcessor.js` – monthly/hourly aggregations, KPI calculations.
  - `js/charts.js`, `js/comparisonCharts.js`, `js/forecast.js`, `js/stats.js` – rendering logic.
  - `js/app.js` – bootstraps the page, wires filters/events.
- **Styling**: `css/main.css`, `css/charts.css`. Follow the `DESIGN_SYSTEM.md` rules for spacing, elevation, and motion.

### Building & Deploying

1. Run `python3 -m http.server` inside `apps/dashboard`.
2. Drop the refreshed JSON in `apps/dashboard/data`.
3. Commit the static assets. Deployment is a file upload to the chosen static host (Vercel, Firebase hosting, Netlify, etc.).

## 4. Forecasting & Analytics Services (`services`)

- `forecasting/` contains standalone CLI scripts. They rely on `pandas`, `numpy`, and `scikit-learn` friendly inputs but currently only use the standard lib plus `csv`. Run them with `python services/forecasting/<script>.py`.
- `timesfm_service/` is a placeholder for the TimesFM-powered inference layer. Keep gRPC/REST scaffolding here once implemented instead of polluting the dashboard folder.

## 5. Standard Workflows

### Add a New Year of Data

1. Duplicate `data-pipeline/<prev_year>/<scenario>` into the new year.
2. Replace the XLSM workbook with the new source.
3. Update script default `output_json` targets to include the new year.
4. Run `python inserimento_consumi.py`, `python inserimneto_prezzi.py`, etc.
5. Copy the resulting JSON files into `apps/dashboard/data`.
6. Adjust dashboard copy/labels (e.g., `js/config.js`) and update `docs/ARCHITECTURE.md` if the workflow changed.

### Prototype a New Visualization

1. Build in `apps/prototypes/<feature-name>`.
2. Once accepted, port assets and JS modules into `apps/dashboard`, writing tests or lint rules as needed.
3. Delete/archive the prototype directory after merge to avoid cruft.

## 6. Quality & Maintenance Checklist

- ✅ Keep directories flat and purpose-driven (no nested `scripts/` duplicates).
- ✅ Every folder that contains executable code should include a lightweight README explaining how to run it.
- ✅ After touching the layout, refresh this document so automation (AI assistants, new developers) stay aligned.
- ✅ Prefer deterministic script output – avoid manual edits in exported JSON.
- ✅ When editing UI, mirror the typography/spacings defined in `DESIGN_SYSTEM.md`.
