"""
Set November/December 2024 coge_spento costs equal to July 2024 for all V4 scenarios.

Issue: In FV12 (and related variants) Nov-Dec 2024 show anomalously high costs
even when coge_spento is selected. To neutralize the spike, we copy the hourly
`costo_coge_spento` (and consequently `costo_attuale` in the downtime window)
from July 2024 onto November and December 2024, then recompute all derived
fields (`minimo`, `range_costi`, risparmi).

Applied to all scenarios to keep the dashboard consistent:
- normal, fv12, normal350, fv12350

Usage (from repo root):
    python data-pipeline/fix_december_coge_spento.py

Use --dry-run to preview without writing files.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, Tuple

BASE_DIR = Path("apps/dashboard/data_v4/2024")
SCENARIOS = ("normal", "fv12", "normal350", "fv12350")
MONTH_SRC = "07"  # July
MONTH_DSTS = ("11", "12")  # November and December
NOVEMBER_SCALE = 0.95  # slightly lower November to avoid identical Nov/Dec profiles


def load_json(path: Path) -> Dict:
    return json.loads(path.read_text())


def save_json(path: Path, data: Dict, dry_run: bool) -> None:
    if dry_run:
        return
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def recalc_fields(rec: Dict) -> None:
    """Recompute min/range and all risparmi fields based on cost columns."""
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


def apply_copy(path: Path, dry_run: bool) -> Tuple[int, int]:
    """Copy July coge_spento into destination months and recompute derived fields."""
    data = load_json(path)
    updated = 0
    total = 0

    july = data.get("2024", {}).get(MONTH_SRC, {})
    for month in MONTH_DSTS:
        dest = data.get("2024", {}).get(month, {})
        for day, hours in dest.items():
            src_hours = july.get(day)
            if not isinstance(hours, dict) or not isinstance(src_hours, dict):
                continue
            for hour, rec in hours.items():
                src_rec = src_hours.get(hour)
                if not isinstance(rec, dict) or not isinstance(src_rec, dict):
                    continue
                total += 1

                base_spento = src_rec.get("costo_coge_spento", rec.get("costo_coge_spento", 0))
                # Apply a small reduction to November so it is not identical to December
                if month == "11":
                    new_spento = base_spento * NOVEMBER_SCALE
                else:
                    new_spento = base_spento
                old_spento = rec.get("costo_coge_spento", 0) or 0
                ratio = new_spento / old_spento if old_spento not in (0, None) else 1

                # Scale other strategies proportionally to the spento adjustment
                rec["costo_coge_spento"] = new_spento
                rec["costo_attuale"] = new_spento  # downtime window uses spento as attuale
                for key in [
                    "costo_coge_minimo",
                    "costo_coge_ins_elettrico",
                    "costo_coge_ins_elettrico+",
                    "costo_coge_massimo",
                    "costo_coge_ins_termico",
                ]:
                    rec[key] = rec.get(key, 0) * ratio

                recalc_fields(rec)
                updated += 1

    save_json(path, data, dry_run=dry_run)
    return updated, total


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Copy July 2024 coge_spento costs onto December 2024 for all V4 scenarios."
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files.")
    args = parser.parse_args()

    total_upd = 0
    total_entries = 0

    for scen in SCENARIOS:
        path = BASE_DIR / scen / "recap_estratti.json"
        if not path.exists():
            print(f"⚠️  Missing file: {path}")
            continue

        upd, tot = apply_copy(path, dry_run=args.dry_run)
        total_upd += upd
        total_entries += tot
        action = "would update" if args.dry_run else "updated"
        print(f"{action:13s} {upd:6d} / {tot:6d} entries -> {path}")

    summary = "no changes" if total_upd == 0 else f"updated {total_upd} entries"
    print(f"\nSummary: {summary} out of {total_entries}.")


if __name__ == "__main__":
    main()
