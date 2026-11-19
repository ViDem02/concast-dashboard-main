<div align="center">

# ⚡ Concast Energy Dashboard

F. Adami · L. Arcangeli · V. G. De Matteis · A. De Vidi · I. G. Duta · M. Grisenti · C. Zamuner



**From raw XLSM workbooks to hour‑by‑hour energy decisions.**
Demand, cogeneration, grid, CO₂ and cost, plus the optimizers that decide <b>where</b> each kWh comes from and <b>when</b> the plant uses it.

![HTML](https://img.shields.io/badge/HTML5-static-E34F26?style=flat-square&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/Vanilla_JS-no_build-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Python](https://img.shields.io/badge/Python-data_pipeline-3776AB?style=flat-square&logo=python&logoColor=white)
![MILP](https://img.shields.io/badge/MILP-optimized_dispatch-10B981?style=flat-square)
![Scheduling](https://img.shields.io/badge/Scheduling-shifts_%26_chiller-0EA5E9?style=flat-square)

<br>

<img src="docs/assets/milp-preview.svg" alt="Animated bar chart: monthly historical vs MILP-optimized electricity cost, January to October 2025" width="860">

<sub><i>2025, monthly horizon: historical cost (red) vs MILP‑optimized cost (green), with the cut for each month.</i></sub>

</div>

---

## 💶 The headline

Same plant, same demand, same prices, replayed with two levers:
**dispatch**, where the MILP chooses between grid and cogeneration every hour, and **timing**, where production shifts and the cold‑room chiller move toward hours with on‑site energy.

<table>
<tr>
<td align="center" width="25%"><h2>€107.8k</h2><sub>saved by dispatch<br>in 2025</sub></td>
<td align="center" width="25%"><h2>−14.7%</h2><sub>electricity spend<br>vs historical</sub></td>
<td align="center" width="25%"><h2>−2.7%</h2><sub>more from shifting production<br>(summer 2025, 3 panels)</sub></td>
<td align="center" width="25%"><h2>90–100%</h2><sub>of chiller energy from<br>on‑site sources (spring–fall)</sub></td>
</tr>
</table>

<details>
<summary><b>Dispatch: every MILP horizon</b> (from <code>risultati milp/&lt;year&gt;/&lt;horizon&gt;/report.txt</code>)</summary>

| Year | Horizon | Historical | Optimized | Savings | Load covered by coge |
| --- | --- | ---: | ---: | ---: | ---: |
| 2025 | hourly  | €733,666 | €625,827 | **€107,839 (14.7%)** | 56.4% |
| 2025 | daily   | €733,666 | €629,988 | €103,678 (14.1%) | 54.5% |
| 2025 | weekly  | €733,666 | €635,355 | €98,311 (13.4%)  | 52.2% |
| 2025 | monthly | €733,666 | €636,255 | €97,412 (13.3%)  | 52.0% |
| 2024 | hourly  | €823,705 | €721,885 | **€101,820 (12.4%)** | 57.7% |
| 2024 | daily   | €823,705 | €727,973 | €95,732 (11.6%)  | 55.4% |
| 2024 | weekly  | €823,705 | €733,625 | €90,080 (10.9%)  | 53.3% |
| 2024 | monthly | €823,705 | €735,055 | €88,650 (10.8%)  | 52.9% |

The finer the horizon, the bigger the savings: hourly decisions follow price swings that monthly plans can't.

</details>

<details>
<summary><b>Timing: shifts and chiller, season by season</b> (from <code>apps/dashboard/prodopti/data/…/timetable.csv</code>)</summary>

Change in cost, optimized production plan vs original plan:

| Season | 2024 · 1 panel | 2024 · 3 panels | 2025 · 1 panel | 2025 · 3 panels |
| --- | ---: | ---: | ---: | ---: |
| ❄️ Winter | −1.1% | −0.7% | −0.6% | −0.8% |
| 🌸 Spring | −0.9% | −1.9% | −0.6% | +0.8% |
| ☀️ Summer | −0.8% | −0.9% | −1.9% | **−2.7% (€1,333)** |
| 🍂 Fall   | −0.5% | −0.7% | — | — |

Six production phases (`b_burr`, `b_conf`, `b_past`, `s_finit`, `s_hiro`, `s_torre`) have their shifts moved by up to ±120 min. The chiller works as a thermal battery: it pre‑cools while solar and coge are producing and coasts on stored cold when they aren't, always within its temperature band.

</details>

---

## 🧭 What's inside

| Page | What it answers |
| --- | --- |
| 🏠 **Dashboard** · `index.html` | How is the plant doing? Overall KPIs, demand, cogeneration, grid purchases and savings, hour by hour. |
| 📈 **Statistiche EE** · `stats.html` | What does electric demand look like day by day? Detailed electricity statistics. |
| 🧮 **MILP** · `milp.html` | What would optimal dispatch have cost? Coverage, savings vs baseline and grid vs coge split, by hour, day, week or month. |
| 🔭 **Scenario 2026** · `forecast.html` | What's next? History plus FV12 solar plus three PUN/PSV price scenarios, with a suggested coge mode per month. |
| 🌱 **CO₂** · `co2.html` | How much CO₂ do we avoid? Savings translated into plain‑language comparisons. |
| 🏭 **Shift produzione** · `prodopti.html` | When should the plant consume? A Gantt chart of original vs shifted production, minutes moved per shift, the chiller's on‑site vs grid power and cold‑room temperatures, per season, with one vs three solar panels. |

---

## 🔁 How the data flows

```mermaid
flowchart LR
    A["📊 XLSM workbooks<br/>demand · gas/PUN prices · setpoints"] --> B["🐍 Python scripts<br/>normalize · fix · validate hours"]
    B --> C["🗂️ JSON<br/>year → month → day → hour"]
    C --> D["🖥️ Dashboard<br/>apps/dashboard"]
    C --> E["🧮 MILP solver<br/>min cost · demand = grid + coge"]
    E --> F["📄 CSV + report<br/>risultati milp/"]
    F --> D
    C --> G["⏱️ Shift & chiller scheduler<br/>5‑min timetables · cold‑room limits"]
    G --> H["📄 Timetables + shift plans<br/>prodopti/data/"]
    H --> D
```

| Stage | What happens | Where |
| --- | --- | --- |
| **Source** | Hourly workbooks per year and scenario (`normal`, `fv12`, `350` variants). | `data V3/`, `data V4/` |
| **Clean** | Scripts normalize headers, fix formats and coge edge cases, and validate every hour. | `data-pipeline/*.py` |
| **Shape** | Output becomes nested `year → month → day → hour` JSON. | `data-pipeline/<year>/<scenario>/*_estratti_<year>.json` |
| **Optimize** | The MILP balances demand = grid + coge, respects setpoints and minimizes total cost. The scheduler shifts production phases and drives the chiller toward cheap, self‑generated hours. | `risultati milp/<year>/<horizon>/`<br>`apps/dashboard/prodopti/data/` |
| **Serve** | The dashboard fetches JSON and CSV straight from disk. Nothing is edited by hand. | `apps/dashboard/data/` |

> **Every chart traces back to a specific workbook and script.** No numbers are typed in by hand.

---

## 🚀 Run it locally

No build step and no dependencies. It's a static site.

```bash
cd apps/dashboard
python3 -m http.server 8000
# → open http://localhost:8000
```

**Deploy:** `apps/dashboard` is configured for Firebase Hosting (`firebase deploy` from that folder). Any static host works.

**Windows, no Python:** [`desktop/windows_launcher`](desktop/windows_launcher/README.md) builds a one‑click `ConcastDashboard.exe` that serves the dashboard from the system tray.

---

## 🗂️ Repo map

```
apps/dashboard/          static site: HTML, CSS, vanilla JS, data/
  └─ prodopti/data/      shift + chiller timetables per year/season/panel setup
apps/prototypes/         experiments before they reach production
data-pipeline/           XLSM → JSON scripts and per-year/scenario outputs
risultati milp/          MILP solver outputs: CSV, report.txt, plots
services/forecasting/    2026 forecast builders and PUN estimators
desktop/windows_launcher Windows .exe packaging
docs/                    architecture notes and README assets
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for workflows such as adding a new year of data, and [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) for the UI rules.

---

<div align="center">

### Why it matters

**Transparent:** every number is auditable · **Proven:** about €100k/year from dispatch, with more from smarter timing · **Ready for the future:** solar and market shifts are already modeled · **Fast:** history, optimization, scheduling and forecast in one place

</div>
