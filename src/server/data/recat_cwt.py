#!/usr/bin/env python3
"""
Extract FAA wake-category fields from FAA Order JO 7360.1E (Aircraft Type Designators).

Extracted fields per ICAO type designator:
- ICAO WTC (Light/Medium/Heavy/Super)
- RECAT 1.5 wake category
- RECAT 2.0 wake category (Appendix A)
- RECAT 2.0 wake category (Appendix B)
- CWT (Consolidated Wake Turbulence) wake category (A–I / NOWGT)
"""


from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import subprocess
from typing import Dict, Optional

APP_A_TITLE_RE = re.compile(r"^\s*Appendix A\. Aircraft Type Designator(s)?\s*$", re.IGNORECASE)
APP_B_TITLE_RE = re.compile(r"^\s*Appendix B\.", re.IGNORECASE)
HEADER_KEY_RE = re.compile(r"RECAT\s+Wake\s+Category", re.IGNORECASE)

WTC_SET = {"Light", "Medium", "Heavy", "Super"}

# Type designator at far-left column; some rows have trailing "*".
DESIG_RE = re.compile(r"^\s{0,4}([A-Z0-9]{2,5}\*?)\s{2,}")

# Split on 2+ spaces to preserve embedded single spaces.
SPLIT_RE = re.compile(r"\s{2,}")


def run_pdftotext(pdf_path: str, txt_path: str) -> None:
    """Convert PDF to text with layout preserved."""
    cmd = ["pdftotext", "-layout", pdf_path, txt_path]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    except FileNotFoundError as e:
        raise RuntimeError("pdftotext not found. Install poppler-utils.") from e
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"pdftotext failed: {e.stderr.decode('utf-8', errors='replace')}") from e


def parse_appendix_a(txt_path: str) -> Dict[str, Dict[str, Optional[str]]]:
    """Parse Appendix A table and return mapping: designator -> wake fields."""
    out: Dict[str, Dict[str, Optional[str]]] = {}

    in_app_a = False
    header_window = 0  # when Appendix A title is seen, look ahead for table header

    with open(txt_path, "r", encoding="utf-8", errors="ignore") as f:
        for raw in f:
            line = raw.rstrip("\n")

            if not in_app_a:
                if APP_A_TITLE_RE.match(line):
                    header_window = 25
                if header_window:
                    header_window -= 1
                    if HEADER_KEY_RE.search(line):
                        in_app_a = True
                continue

            if APP_B_TITLE_RE.match(line):
                break

            m = DESIG_RE.match(line)
            if not m:
                continue

            tokens = [t.strip() for t in SPLIT_RE.split(line.strip()) if t.strip()]
            if not tokens:
                continue

            designator_raw = tokens[0]
            designator = designator_raw[:-1] if designator_raw.endswith("*") else designator_raw

            rec = out.get(designator)
            if rec is None:
                rec = {
                    "designator_raw": designator_raw,
                    "icao_wtc": None,
                    "recat_1_5": None,
                    "recat_2_0_apdx_a": None,
                    "recat_2_0_apdx_b": None,
                    "cwt": None,
                }
                out[designator] = rec

            # Standard table row layout:
            # 0 designator
            # 1 class
            # 2 engine/type/FAA weight class
            # 3 ICAO WTC
            # 4 RECAT 1.5
            # 5 RECAT 2.0 Apdx A
            # 6 RECAT 2.0 Apdx B
            # 7 CWT
            if len(tokens) >= 8 and tokens[3] in WTC_SET:
                rec["icao_wtc"] = tokens[3] or rec["icao_wtc"]
                rec["recat_1_5"] = tokens[4] if tokens[4] else None
                rec["recat_2_0_apdx_a"] = tokens[5] if tokens[5] else None
                rec["recat_2_0_apdx_b"] = tokens[6] if tokens[6] else None
                rec["cwt"] = tokens[7] if tokens[7] else None

    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, help="Path to FAA JO 7360.1E PDF")
    ap.add_argument("--out", required=True, help="Output JSON path")
    ap.add_argument("--keep_txt", action="store_true", help="Keep intermediate .txt")
    args = ap.parse_args()

    pdf_path = os.path.abspath(args.pdf)
    out_path = os.path.abspath(args.out)

    if not os.path.isfile(pdf_path):
        raise SystemExit(f"PDF not found: {pdf_path}")

    txt_path = f"{out_path}.txt"
    run_pdftotext(pdf_path, txt_path)
    aircraft = parse_appendix_a(txt_path)

    payload = {
        "source": {
            "title": "FAA Order JO 7360.1E Aircraft Type Designators",
            "pdf": os.path.basename(pdf_path),
            "extracted_with": "pdftotext -layout",
        },
        "count": len(aircraft),
        "aircraft": aircraft,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)

    if not args.keep_txt:
        with contextlib.suppress(OSError):
            os.remove(txt_path)


if __name__ == "__main__":
    main()
