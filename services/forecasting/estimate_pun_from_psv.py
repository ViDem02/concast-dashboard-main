#!/usr/bin/env python3
"""
Estimate monthly PUN values for 2025-2026 using the qualitative scenarios
described by Livio Di Carlo (PUN bands) and the natural gas forecasts that
the user selected for PSV (Forex Trading Italia, update 3 March 2025).

The Forex table is quoted in USD and does not map 1:1 to the PSV €/MWh.
To stay coherent with the April 2025 benchmark (PSV 33.30 €/MWh when the
Forex close is 4.39), we calibrate a simple conversion factor:

    PSV_EUR_per_MWh ≈ gas_close_value * 7.6

This keeps the forecast within the 30-45 €/MWh range expected by the
“scenario standard”.  Once PSV is known, we assign the corresponding scenario
and derive the PUN using the published bands:
    - Optimistic:   PUN < 90 €/MWh, PSV <= 30 €/MWh
    - Standard:     95 ≤ PUN ≤ 115 €/MWh, 30 < PSV <= 45 €/MWh
    - Pessimistic:  PUN > 140 €/MWh, PSV > 45 €/MWh

The mapping is handled linearly inside each band so the output remains smooth.
"""
from __future__ import annotations

import argparse
import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List


CONVERSION_FACTOR = 7.6  # 4.39 * 7.6 ≈ 33.3 €/MWh (April 2025 benchmark)


@dataclass(frozen=True)
class GasForecast:
    year: int
    month: int
    closing_usd: float
    note: str = ""


GAS_FORECAST: Dict[int, List[GasForecast]] = {
    2025: [
        # No explicit January value in the source, reuse February's level to avoid gaps.
        GasForecast(2025, 1, 4.41, "Assumed = Feb 2025 due to missing data"),
        GasForecast(2025, 2, 4.41),
        GasForecast(2025, 3, 4.14),
        GasForecast(2025, 4, 4.39),
        GasForecast(2025, 5, 4.66),
        GasForecast(2025, 6, 4.37),
        GasForecast(2025, 7, 4.65),
        GasForecast(2025, 8, 4.88),
        GasForecast(2025, 9, 4.58),
        GasForecast(2025, 10, 4.60),
        GasForecast(2025, 11, 4.89),
        GasForecast(2025, 12, 5.19),
    ],
    2026: [
        GasForecast(2026, 1, 4.90),
        GasForecast(2026, 2, 4.60),
        GasForecast(2026, 3, 4.31),
        GasForecast(2026, 4, 4.05),
        GasForecast(2026, 5, 3.80),
        GasForecast(2026, 6, 4.03),
        GasForecast(2026, 7, 4.27),
        GasForecast(2026, 8, 4.47),
        GasForecast(2026, 9, 4.26),
        GasForecast(2026, 10, 4.52),
        GasForecast(2026, 11, 4.25),
        GasForecast(2026, 12, 4.51),
    ],
}


def map_linear(value: float, x0: float, x1: float, y0: float, y1: float) -> float:
    if x1 == x0:
        return y1
    ratio = (value - x0) / (x1 - x0)
    return y0 + ratio * (y1 - y0)


def classify_psv(psv_eur_mwh: float) -> str:
    if psv_eur_mwh <= 30:
        return "optimistic"
    if psv_eur_mwh <= 45:
        return "standard"
    return "pessimistic"


def estimate_pun(psv_eur_mwh: float, scenario: str) -> float:
    if scenario == "optimistic":
        if psv_eur_mwh <= 20:
            slope = (90 - 80) / (30 - 20)
            return 80 - slope * (20 - psv_eur_mwh)
        return map_linear(psv_eur_mwh, 20, 30, 80, 90)
    if scenario == "standard":
        return map_linear(psv_eur_mwh, 30, 45, 95, 115)
    # Pessimistic: anchor 45-60 -> 140-165, extend beyond 60 with same slope
    if psv_eur_mwh <= 60:
        return map_linear(psv_eur_mwh, 45, 60, 140, 165)
    slope = (165 - 140) / (60 - 45)
    return 165 + slope * (psv_eur_mwh - 60)


def build_rows() -> List[Dict[str, object]]:
    rows: List[Dict[str, object]] = []
    for year, entries in GAS_FORECAST.items():
        for entry in entries:
            psv_eur = round(entry.closing_usd * CONVERSION_FACTOR, 2)
            scenario = classify_psv(psv_eur)
            pun = round(estimate_pun(psv_eur, scenario), 2)
            rows.append(
                {
                    "year": entry.year,
                    "month": entry.month,
                    "psv_close_usd": entry.closing_usd,
                    "psv_eur_per_mwh": psv_eur,
                    "scenario": scenario,
                    "pun_eur_per_mwh": pun,
                    "note": entry.note,
                }
            )
    return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a PUN projection CSV from PSV/gas forecasts."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data-pipeline/2025/normal/pun_projection_2025_2026.csv"),
        help="Where to store the projection CSV.",
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        help="Optional JSON version of the projection table.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = build_rows()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "year",
                "month",
                "psv_close_usd",
                "psv_eur_per_mwh",
                "scenario",
                "pun_eur_per_mwh",
                "note",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {args.output}")

    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
        print(f"Wrote JSON payload to {args.json_output}")


if __name__ == "__main__":
    main()
