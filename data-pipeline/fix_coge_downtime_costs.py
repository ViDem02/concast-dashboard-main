"""
Fix the coge downtime period (18 Nov 2024 → 10 Feb 2025) in V4 recap data.

During that window the cogenerator was off, so the effective cost shown in
the dashboard must match the "coge_spento" strategy. This script updates
`costo_attuale` to equal `costo_coge_spento` and realigns
`risparmio_possibile` (which is `costo_attuale - minimo`) for every hour in
the affected period across all V4 scenarios.

Usage (from repository root):
    python data-pipeline/fix_coge_downtime_costs.py

Use --dry-run to see how many entries would change without writing files.
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Dict, Tuple

# Inclusive downtime window
START = date(2024, 11, 18)
END = date(2025, 2, 10)

# Scenarios to process under apps/dashboard/data_v4/<year>/<scenario>/
SCENARIOS = ("normal", "fv12", "normal350", "fv12350")
YEARS = ("2024", "2025")

BASE_DIR = Path("apps/dashboard/data_v4")
FILENAME = "recap_estratti.json"


def is_in_downtime(year: str, month: str, day: str) -> bool:
    """Return True if the given Y-M-D falls inside the downtime window."""
    current = date(int(year), int(month), int(day))
    return START <= current <= END


def process_file(path: Path, dry_run: bool = False) -> Tuple[int, int]:
    """
    Update a recap file and return (updated_entries, total_entries) counts.
    For the downtime window we force `costo_attuale = costo_coge_spento` and
    recompute all derived fields that depend on cost deltas.
    """
    data: Dict[str, Dict] = json.loads(path.read_text())
    updated = 0
    total = 0

    for year, months in data.items():
        for month, days in months.items():
            for day, hours in days.items():
                if not is_in_downtime(year, month, day):
                    total += len(hours)
                    continue

                for hour, rec in hours.items():
                    total += 1
                    new_attuale = rec.get("costo_coge_spento")
                    if new_attuale is None:
                        continue  # malformed entry; skip defensively

                    # Force attuale to coge_spento
                    rec["costo_attuale"] = new_attuale

                    # Recompute min/max and all delta-based fields
                    costs = [
                        rec.get("costo_attuale", 0),
                        rec.get("costo_coge_spento", 0),
                        rec.get("costo_coge_minimo", 0),
                        rec.get("costo_coge_ins_elettrico", 0),
                        rec.get("costo_coge_ins_elettrico+", 0),
                        rec.get("costo_coge_massimo", 0),
                        rec.get("costo_coge_ins_termico", 0),
                    ]
                    minimo = min(costs)
                    massimo = max(costs)
                    rec["minimo"] = minimo
                    rec["range_costi"] = massimo - minimo

                    rec["risparmio_possibile"] = rec["costo_attuale"] - minimo
                    rec["risparmio_spento"] = rec["costo_coge_spento"] - minimo
                    rec["risparmio_minimo"] = rec["costo_coge_minimo"] - minimo
                    rec["risparmio_ins_ele"] = rec["costo_coge_ins_elettrico"] - minimo
                    rec["risparmio_ins_ele+"] = rec["costo_coge_ins_elettrico+"] - minimo
                    rec["risparmio_massimo"] = rec["costo_coge_massimo"] - minimo
                    rec["risparmio_ins_frigo"] = rec["costo_coge_ins_termico"] - minimo
                    rec["risparmio_su_benchmark"] = massimo - minimo
                    rec["risparmi"] = massimo - minimo

                    updated += 1

    if updated and not dry_run:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

    return updated, total


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Set costo_attuale = costo_coge_spento for the coge downtime window (Nov 18 2024 - Feb 10 2025)."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only report how many entries would change without writing files.",
    )
    args = parser.parse_args()

    if not BASE_DIR.exists():
        raise SystemExit(f"Base data directory not found: {BASE_DIR}")

    total_updates = 0
    total_entries = 0

    for year in YEARS:
        for scenario in SCENARIOS:
            path = BASE_DIR / year / scenario / FILENAME
            if not path.exists():
                print(f"⚠️  Missing file: {path}")
                continue
            updated, entries = process_file(path, dry_run=args.dry_run)
            total_updates += updated
            total_entries += entries
            status = "would update" if args.dry_run else "updated"
            print(f"{status:13s} {updated:6d} / {entries:6d} entries -> {path}")

    print(f"\nSummary: {'no changes' if total_updates == 0 else f'updated {total_updates} entries'} out of {total_entries}.")


if __name__ == "__main__":
    main()
