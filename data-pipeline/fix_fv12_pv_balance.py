"""
Normalize FV12/FV12350 November-December 2024 consumi against the normal baseline.

Problem: FV12 (and FV12350) show unrealistic consumi in Nov-Dec 2024. The intended
difference vs normal is only extra fotovoltaico (ee_prod_altro) which should
reduce grid acquisition, not distort other flows.

Approach:
- Use the normal scenario as baseline (normal -> fv12, normal350 -> fv12350).
- For Nov and Dec 2024, copy all baseline fields.
- Keep the original FV fotovoltaico (`ee_prod_altro_kwh`) from the FV file.
- Recompute `ee_acquistata_kwh` and `ee_ceduta_kwh` by offsetting the baseline
  acquisition with the added PV:
    net = baseline_acquistata - pv
    if net >= 0: acquistata = net; ceduta = 0
    else:        acquistata = 0;   ceduta = -net

This preserves the same fabbisogno/prod coge/gas as the normal scenario while
only injecting the extra PV and the corresponding reduction in grid purchase.

Usage (from repo root):
    python data-pipeline/fix_fv12_pv_balance.py

Use --dry-run to preview changes.
"""

from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path
from typing import Dict, Tuple

BASE_DIR = Path("apps/dashboard/data_v4")
YEAR = "2024"
MONTHS = {"11", "12"}

PAIRINGS = [
    ("normal", "fv12"),
    ("normal350", "fv12350"),
]


def load_json(path: Path) -> Dict:
    return json.loads(path.read_text())


def save_json(path: Path, data: Dict, dry_run: bool) -> None:
    if dry_run:
        return
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def adjust_pair(baseline_path: Path, target_path: Path, dry_run: bool) -> Tuple[int, int]:
    """Return (updated_entries, total_entries) for the target file."""
    baseline = load_json(baseline_path)
    target = load_json(target_path)

    updated = 0
    total = 0

    for month, days in baseline.get(YEAR, {}).items():
        if month not in MONTHS:
            continue
        for day, hours in days.items():
            if not isinstance(hours, dict):
                continue
            for hour, base_rec in hours.items():
                if not isinstance(base_rec, dict):
                    continue
                total += 1

                # Defensive: ensure target has the parallel structure
                tgt_day = target.setdefault(YEAR, {}).setdefault(month, {}).setdefault(day, {})
                tgt_rec = tgt_day.get(hour)
                if not isinstance(tgt_rec, dict):
                    tgt_rec = {}
                pv = tgt_rec.get("ee_prod_altro_kwh", 0)

                # Copy baseline as the starting point
                new_rec = deepcopy(base_rec)

                # Inject PV from FV and rebalance acquisition/ceduta
                base_acq = base_rec.get("ee_acquistata_kwh", 0)
                net = base_acq - pv
                if net >= 0:
                    new_acq = net
                    new_ced = 0
                else:
                    new_acq = 0
                    new_ced = -net

                new_rec["ee_prod_altro_kwh"] = pv
                new_rec["ee_acquistata_kwh"] = new_acq
                new_rec["ee_ceduta_kwh"] = new_ced

                tgt_day[hour] = new_rec
                updated += 1

    save_json(target_path, target, dry_run=dry_run)
    return updated, total


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Align FV12/FV12350 Nov-Dec 2024 consumi to normal baseline, keeping only PV as difference."
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files.")
    args = parser.parse_args()

    total_upd = 0
    total_entries = 0

    for baseline_name, target_name in PAIRINGS:
        baseline_path = BASE_DIR / YEAR / baseline_name / "inserimento_consumi_estratti.json"
        target_path = BASE_DIR / YEAR / target_name / "inserimento_consumi_estratti.json"

        if not baseline_path.exists() or not target_path.exists():
            print(f"⚠️  Missing files for pair {baseline_name} -> {target_name}")
            continue

        upd, tot = adjust_pair(baseline_path, target_path, dry_run=args.dry_run)
        total_upd += upd
        total_entries += tot
        action = "would update" if args.dry_run else "updated"
        print(f"{action:13s} {upd:6d} / {tot:6d} entries -> {target_path}")

    print(f"\nSummary: {'no changes' if total_upd == 0 else f'updated {total_upd} entries'} out of {total_entries}.")


if __name__ == "__main__":
    main()
