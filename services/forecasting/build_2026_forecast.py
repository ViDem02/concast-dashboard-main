#!/usr/bin/env python3
"""
Build a 2026 monthly forecast using the average of historical (2024-2025)
normal-scenario consumptions and the PSV/PUN projections for 2026.

For each month:
  - Take the mean of available 2024/2025 data (EE grid, EE coge, gas, CO2).
  - Convert gas Smc to MWh using a configurable PCI.
  - Apply three market scenarios (optimistic/standard/pessimistic) by shifting
    the baseline PSV/PUN forecast and capping it within the qualitative ranges.
  - Compute grid cost (EE acquistata * PUN) and gas cost (gas Smc * PSV).

Outputs a JSON payload ready for the new forecast page.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from datetime import datetime
from statistics import mean
from typing import Dict, List, Tuple


MONTH_NAMES = [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
]

GAS_KWH_PER_SMC = 10.55  # PCI medio gas naturale (kWh per Smc)
HISTORY_START_YEAR = 2024
HISTORY_END_YEAR = 2025
HISTORY_END_MONTH = 9  # Usare dati completi fino a Set 2025

SCENARIOS = {
    "optimistic": {
        "label": "Scenario Ottimistico",
        "description": "PUN e PSV compressi da FER elevate, clima mite e domanda contenuta.",
        "pun_shift": -12.0,
        "pun_max": 89.0,
        "psv_shift": -5.0,
        "psv_max": 29.0,
    },
    "standard": {
        "label": "Scenario Standard",
        "description": "Mercato stabile con PUN allineato al range 95-115 €/MWh.",
        "pun_shift": 0.0,
        "psv_shift": 0.0,
    },
    "pessimistic": {
        "label": "Scenario Pessimistico",
        "description": "Stress su gas ed elettrico: siccità, ondate di calore, shock geopolitici.",
        "pun_shift": 45.0,
        "pun_min": 140.0,
        "psv_shift": 27.0,
        "psv_min": 60.0,
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate 2026 forecast payload for the webapp.")
    parser.add_argument(
        "--monthly-summary",
        type=Path,
        default=Path("webapp/data/monthly_summary.json"),
        help="JSON produced by generate_monthly_consumption_csv.py",
    )
    parser.add_argument(
        "--pun-json",
        type=Path,
        default=Path("webapp/data/pun_projection.json"),
        help="JSON produced by estimate_pun_from_psv.py",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("webapp/data/forecast_2026.json"),
        help="Path of the forecast JSON to write.",
    )
    parser.add_argument(
        "--pv-override",
        type=Path,
        default=Path("data-pipeline/2026/pv_estimate_2026.json"),
        help="Optional hourly PV estimate JSON (with fields datetime, tot_kwh) to override PV for 2026.",
    )
    return parser.parse_args()


def load_monthly_summary(path: Path) -> Tuple[Dict, List[Dict]]:
    payload = json.loads(path.read_text())
    return payload.get("meta", {}), payload.get("data", [])


def load_pun_rows(path: Path) -> Dict[Tuple[int, int], Dict]:
    rows = json.loads(path.read_text())
    return {(row["year"], row["month"]): row for row in rows}


def avg(values: List[float]) -> float:
    return mean(values) if values else 0.0


def adjust_value(base: float, shift: float = 0.0, minimum: float | None = None, maximum: float | None = None) -> float:
    value = base + shift
    if maximum is not None:
        value = min(value, maximum)
    if minimum is not None:
        value = max(value, minimum)
    return round(value, 2)


def compute_monthly_forecast(
    month: int,
    history_rows: List[Dict],
    standard_pun: float,
    standard_psv: float,
    grid_emission_factor: float,
    pv_override_kwh: float | None = None,
) -> Dict:
    ee_grid = avg([row["ee_grid_kwh"] for row in history_rows])
    ee_coge = avg([row["ee_coge_kwh"] for row in history_rows])
    gas_smc = avg([row["gas_coge_smc"] for row in history_rows])
    co2_grid = avg([row["co2_grid_kg"] for row in history_rows])
    co2_coge = avg([row["co2_coge_kg"] for row in history_rows])
    ee_pv = pv_override_kwh if pv_override_kwh is not None else avg([row.get("ee_pv_kwh", 0.0) or 0.0 for row in history_rows])

    ee_total = ee_grid + ee_coge
    ee_total_with_pv = ee_total + ee_pv
    gas_mwh = (gas_smc * GAS_KWH_PER_SMC) / 1000.0
    grid_factor = grid_emission_factor or 0.0
    co2_avoided = ee_pv * grid_factor

    scenarios_payload = {}
    for scenario_key, config in SCENARIOS.items():
        pun = adjust_value(
            standard_pun,
            shift=config.get("pun_shift", 0.0),
            minimum=config.get("pun_min"),
            maximum=config.get("pun_max"),
        )
        psv = adjust_value(
            standard_psv,
            shift=config.get("psv_shift", 0.0),
            minimum=config.get("psv_min"),
            maximum=config.get("psv_max"),
        )

        grid_cost = round((ee_grid / 1000.0) * pun, 2)
        gas_cost = round(gas_mwh * psv, 2)
        scenarios_payload[scenario_key] = {
            "pun_eur_per_mwh": pun,
            "psv_eur_per_mwh": psv,
            "grid_cost_eur": grid_cost,
            "gas_cost_eur": gas_cost,
            "total_cost_eur": round(grid_cost + gas_cost, 2),
        }

    return {
        "month": month,
        "label": MONTH_NAMES[month - 1],
        "sources": [row["year"] for row in history_rows],
        "history": history_rows,
        "ee_grid_kwh": round(ee_grid, 3),
        "ee_coge_kwh": round(ee_coge, 3),
        "ee_total_kwh": round(ee_total, 3),
        "ee_pv_kwh": round(ee_pv, 3),
        "ee_total_with_pv_kwh": round(ee_total_with_pv, 3),
        "gas_coge_smc": round(gas_smc, 3),
        "co2_grid_kg": round(co2_grid, 3),
        "co2_coge_kg": round(co2_coge, 3),
        "co2_avoided_kg": round(co2_avoided, 3),
        "scenarios": scenarios_payload,
    }


def main() -> None:
    args = parse_args()
    summary_meta, monthly_rows = load_monthly_summary(args.monthly_summary)
    pun_rows = load_pun_rows(args.pun_json)
    grid_factor = summary_meta.get("grid_emission_factor_kg_per_kwh", 0.0) or 0.0

    pv_override = {}
    if args.pv_override and args.pv_override.exists():
        try:
            hourly_pv = json.loads(args.pv_override.read_text())
            for row in hourly_pv:
                ts = row.get("datetime")
                try:
                    dt = datetime.fromisoformat(ts.replace(" ", "T"))
                except Exception:
                    continue
                pv_override.setdefault(dt.month, 0.0)
                pv_override[dt.month] += float(row.get("tot_kwh", 0.0) or 0.0)
        except Exception:
            pv_override = {}

    history_by_month: Dict[int, List[Dict]] = {m: [] for m in range(1, 13)}
    for row in monthly_rows:
        year = row.get("year")
        month = row.get("month")
        if year is None or month is None:
            continue
        if year < HISTORY_START_YEAR or year > HISTORY_END_YEAR:
            continue
        if year == HISTORY_END_YEAR and month > HISTORY_END_MONTH:
            continue
        history_by_month[month].append(row)

    months_payload = []
    scenario_totals: Dict[str, Dict[str, float]] = {
        key: {"grid_cost_eur": 0.0, "gas_cost_eur": 0.0, "total_cost_eur": 0.0, "pun_values": [], "psv_values": []}
        for key in SCENARIOS
    }

    total_aggregates = {
        "ee_total_kwh": 0.0,
        "ee_grid_kwh": 0.0,
        "ee_coge_kwh": 0.0,
        "ee_pv_kwh": 0.0,
        "ee_total_with_pv_kwh": 0.0,
        "gas_coge_smc": 0.0,
        "co2_total_kg": 0.0,
        "co2_avoided_kg": 0.0,
    }

    for month in range(1, 13):
        history = history_by_month.get(month, [])
        if not history:
            raise ValueError(f"No historical data available for month {month}.")

        pun_entry = pun_rows.get((2026, month))
        if not pun_entry:
            raise ValueError(f"Missing PUN projection for 2026 month {month}.")

        month_payload = compute_monthly_forecast(
            month,
            history,
            standard_pun=pun_entry["pun_eur_per_mwh"],
            standard_psv=pun_entry["psv_eur_per_mwh"],
            grid_emission_factor=grid_factor,
            pv_override_kwh=pv_override.get(month),
        )
        months_payload.append(month_payload)

        total_aggregates["ee_total_kwh"] += month_payload["ee_total_kwh"]
        total_aggregates["ee_grid_kwh"] += month_payload["ee_grid_kwh"]
        total_aggregates["ee_coge_kwh"] += month_payload["ee_coge_kwh"]
        total_aggregates["ee_pv_kwh"] += month_payload["ee_pv_kwh"]
        total_aggregates["ee_total_with_pv_kwh"] += month_payload["ee_total_with_pv_kwh"]
        total_aggregates["gas_coge_smc"] += month_payload["gas_coge_smc"]
        total_aggregates["co2_total_kg"] += month_payload["co2_grid_kg"] + month_payload["co2_coge_kg"]
        total_aggregates["co2_avoided_kg"] += month_payload["co2_avoided_kg"]

        for scenario_key, scenario_data in month_payload["scenarios"].items():
            scenario_totals[scenario_key]["grid_cost_eur"] += scenario_data["grid_cost_eur"]
            scenario_totals[scenario_key]["gas_cost_eur"] += scenario_data["gas_cost_eur"]
            scenario_totals[scenario_key]["total_cost_eur"] += scenario_data["total_cost_eur"]
            scenario_totals[scenario_key]["pun_values"].append(scenario_data["pun_eur_per_mwh"])
            scenario_totals[scenario_key]["psv_values"].append(scenario_data["psv_eur_per_mwh"])

    scenario_stats = {}
    for key, totals in scenario_totals.items():
        scenario_stats[key] = {
            "grid_cost_eur": round(totals["grid_cost_eur"], 2),
            "gas_cost_eur": round(totals["gas_cost_eur"], 2),
            "total_cost_eur": round(totals["total_cost_eur"], 2),
            "avg_pun_eur_per_mwh": round(avg(totals["pun_values"]), 2),
            "avg_psv_eur_per_mwh": round(avg(totals["psv_values"]), 2),
        }

    payload = {
        "meta": {
            "years_used": sorted({row["year"] for row in monthly_rows if row["year"] in (2024, 2025)}),
            "grid_emission_factor_kg_per_kwh": summary_meta.get("grid_emission_factor_kg_per_kwh"),
            "methane_emission_factor_kg_per_smc": summary_meta.get("methane_emission_factor_kg_per_smc"),
            "gas_kwh_per_smc": GAS_KWH_PER_SMC,
            "scenarios": SCENARIOS,
            "scenario_stats": scenario_stats,
            "totals": {
                "ee_total_kwh": round(total_aggregates["ee_total_kwh"], 3),
                "ee_grid_kwh": round(total_aggregates["ee_grid_kwh"], 3),
                "ee_coge_kwh": round(total_aggregates["ee_coge_kwh"], 3),
                "ee_pv_kwh": round(total_aggregates["ee_pv_kwh"], 3),
                "ee_total_with_pv_kwh": round(total_aggregates["ee_total_with_pv_kwh"], 3),
                "gas_coge_smc": round(total_aggregates["gas_coge_smc"], 3),
                "co2_total_kg": round(total_aggregates["co2_total_kg"], 3),
                "co2_avoided_kg": round(total_aggregates["co2_avoided_kg"], 3),
            },
            "notes": (
                "Media mensile 2024-2025 (Normal) su dati completi da Gen 2024 a Set 2025, senza esclusioni. "
                "FV stimato dagli scenari ottimizzati (FV12)."
            ),
        },
        "months": months_payload,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"Wrote 2026 forecast to {args.output}")


if __name__ == "__main__":
    main()
