#!/usr/bin/env python3
"""
Aggregates hourly inserimento_consumi data for 2024/2025 (normal scenario)
into a monthly CSV that excludes photovoltaic production and keeps the
columns needed to later plug in custom PUN and emission factors.
"""
from __future__ import annotations
import argparse
import csv
import json
from pathlib import Path
from typing import Dict, Iterable, Tuple


DEFAULT_YEARS = (2024, 2025)
DEFAULT_OUTPUT = Path("data-pipeline/2025/normal/ee_monthly_no_pv.csv")
DEFAULT_GRID_CO2 = 0.33  # kg CO2 per kWh of electricity purchased (Italy avg 2022)
DEFAULT_METHANE_CO2 = 1.9  # kg CO2 per Smc of natural gas for the coge
DEFAULT_PV_SCENARIO = "FV12"
PV_FIELD_NAME = "ee_prod_altro_kwh"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate a CSV with monthly EE needs (grid + coge, no PV) and CO2 impacts."
        )
    )
    parser.add_argument(
        "--years",
        nargs="+",
        type=int,
        default=list(DEFAULT_YEARS),
        help="Years to include (expects data-pipeline/{year}/normal/inserimento_consumi_estratti_{year}.json).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Path of the CSV to write (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--grid-emission-kg-per-kwh",
        type=float,
        default=DEFAULT_GRID_CO2,
        help="Emission factor for electricity drawn from the grid.",
    )
    parser.add_argument(
        "--methane-emission-kg-per-smc",
        type=float,
        default=DEFAULT_METHANE_CO2,
        help="Emission factor for natural gas burnt by the cogenerator (per Smc).",
    )
    parser.add_argument(
        "--pun-file",
        type=Path,
        help=(
            "Optional CSV/JSON with columns (year,month,pun_eur_per_mwh) or "
            'a JSON structured as {"2024": {"01": 95.0}}. '
            "If omitted, the PUN and EE cost columns are left blank."
        ),
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        help="Optional path to also dump the monthly aggregation as JSON (with metadata).",
    )
    parser.add_argument(
        "--pv-scenario",
        type=str,
        default=DEFAULT_PV_SCENARIO,
        help=(
            "Name of the scenario folder inside data-pipeline/{year} that contains "
            "the optimized photovoltaic JSON (set to an empty string to skip PV aggregation)."
        ),
    )
    return parser.parse_args()


def load_json_data(year: int) -> Dict[str, Dict]:
    json_path = Path(f"data-pipeline/{year}/normal/inserimento_consumi_estratti_{year}.json")
    if not json_path.exists():
        raise FileNotFoundError(f"Missing data file: {json_path}")

    with json_path.open() as fh:
        payload = json.load(fh)

    try:
        return payload[str(year)]
    except KeyError as err:
        raise KeyError(f"{json_path} does not contain data for {year}") from err


def load_pv_json_data(year: int, scenario: str | None) -> Dict[str, Dict]:
    if not scenario:
        return {}

    pv_path = Path(f"data-pipeline/{year}/{scenario}/inserimento_consumi_estratti_{year}.json")
    if not pv_path.exists():
        raise FileNotFoundError(f"Missing PV data file: {pv_path}")

    with pv_path.open() as fh:
        payload = json.load(fh)

    try:
        return payload[str(year)]
    except KeyError as err:
        raise KeyError(f"{pv_path} does not contain data for {year}") from err


def safe_number(value) -> float:
    if value in (None, "", "-"):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def aggregate_monthly(year: int, year_data: Dict[str, Dict]) -> Dict[int, Dict[str, float]]:
    monthly = {}
    for month, days in year_data.items():
        ee_grid = 0.0
        ee_coge = 0.0
        gas_coge = 0.0
        for day in days.values():
            for hour in day.values():
                ee_grid += safe_number(hour.get("ee_acquistata_kwh"))
                ee_coge += safe_number(hour.get("ee_prod_coge_kwh"))
                gas_coge += safe_number(hour.get("gas_consumato_coge_smc"))
        monthly[int(month)] = {
            "ee_grid_kwh": ee_grid,
            "ee_coge_kwh": ee_coge,
            "gas_coge_smc": gas_coge,
        }
    return monthly


def aggregate_pv_monthly(year_data: Dict[str, Dict]) -> Dict[int, float]:
    monthly: Dict[int, float] = {}
    for month, days in year_data.items():
        total_pv = 0.0
        for day in days.values():
            for hour in day.values():
                total_pv += safe_number(hour.get(PV_FIELD_NAME))
        monthly[int(month)] = total_pv
    return monthly


def load_pun(path: Path) -> Dict[Tuple[int, int], float]:
    if not path:
        return {}

    if not path.exists():
        raise FileNotFoundError(f"PUN file {path} not found")

    mapping: Dict[Tuple[int, int], float] = {}
    if path.suffix.lower() == ".json":
        with path.open() as fh:
            data = json.load(fh)
        if all(k.isdigit() for k in data.keys()):
            for year_str, months in data.items():
                year = int(year_str)
                for month_str, value in months.items():
                    mapping[(year, int(month_str))] = float(value)
        else:
            for key, value in data.items():
                year_str, month_str = key.split("-")
                mapping[(int(year_str), int(month_str))] = float(value)
    else:
        with path.open() as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                year = int(row["year"])
                month = int(row["month"])
                mapping[(year, month)] = float(row["pun_eur_per_mwh"])
    return mapping


def build_rows(
    years: Iterable[int],
    grid_co2: float,
    methane_co2: float,
    pun_lookup: Dict[Tuple[int, int], float],
    pv_scenario: str | None,
) -> Iterable[Dict[str, object]]:
    for year in sorted(years):
        year_data = load_json_data(year)
        monthly = aggregate_monthly(year, year_data)
        pv_year_data = load_pv_json_data(year, pv_scenario) if pv_scenario else {}
        pv_monthly = aggregate_pv_monthly(pv_year_data) if pv_year_data else {}
        for month in sorted(monthly):
            ee_grid = monthly[month]["ee_grid_kwh"]
            ee_coge = monthly[month]["ee_coge_kwh"]
            gas_coge = monthly[month]["gas_coge_smc"]
            ee_total = ee_grid + ee_coge
            pv_kwh = pv_monthly.get(month, 0.0)

            pun_value = pun_lookup.get((year, month))
            estimated_cost = (ee_total / 1000.0 * pun_value) if pun_value is not None else None

            co2_grid = ee_grid * grid_co2
            co2_coge = gas_coge * methane_co2
            co2_total = co2_grid + co2_coge

            yield {
                "year": year,
                "month": month,
                "period": f"{year}-{month:02d}",
                "ee_grid_kwh": round(ee_grid, 3),
                "ee_coge_kwh": round(ee_coge, 3),
                "ee_total_no_pv_kwh": round(ee_total, 3),
                "pv_manual_kwh": None,
                "ee_pv_kwh": round(pv_kwh, 3),
                "gas_coge_smc": round(gas_coge, 3),
                "pun_eur_per_mwh": None if pun_value is None else round(pun_value, 3),
                "estimated_ee_cost_eur": None if estimated_cost is None else round(estimated_cost, 2),
                "co2_grid_kg": round(co2_grid, 3),
                "co2_coge_kg": round(co2_coge, 3),
            "co2_total_kg": round(co2_total, 3),
        }


def main() -> None:
    args = parse_args()
    pun_lookup = load_pun(args.pun_file) if args.pun_file else {}
    rows = list(
        build_rows(
            years=args.years,
            grid_co2=args.grid_emission_kg_per_kwh,
            methane_co2=args.methane_emission_kg_per_smc,
            pun_lookup=pun_lookup,
            pv_scenario=args.pv_scenario or None,
        )
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "year",
        "month",
        "period",
        "ee_grid_kwh",
        "ee_coge_kwh",
        "ee_total_no_pv_kwh",
        "pv_manual_kwh",
        "ee_pv_kwh",
        "gas_coge_smc",
        "pun_eur_per_mwh",
        "estimated_ee_cost_eur",
        "co2_grid_kg",
        "co2_coge_kg",
        "co2_total_kg",
    ]
    def to_csv_row(row: Dict[str, object]) -> Dict[str, object]:
        formatted = {}
        for key, value in row.items():
            if value is None:
                formatted[key] = ""
            else:
                formatted[key] = value
        return formatted

    with args.output.open("w", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(to_csv_row(r) for r in rows)

    print(f"Wrote {len(rows)} rows to {args.output}")

    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "meta": {
                "grid_emission_factor_kg_per_kwh": args.grid_emission_kg_per_kwh,
                "methane_emission_factor_kg_per_smc": args.methane_emission_kg_per_smc,
                "pun_source": str(args.pun_file) if args.pun_file else None,
                "pv_scenario": args.pv_scenario or None,
                "pv_field": PV_FIELD_NAME if args.pv_scenario else None,
            },
            "data": rows,
        }
        args.json_output.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
        print(f"Wrote JSON payload to {args.json_output}")


if __name__ == "__main__":
    main()
