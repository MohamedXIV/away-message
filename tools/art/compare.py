#!/usr/bin/env python3
"""Issue #159 — side-by-side treatment review sheets from runtime captures.

Composes the identical-framing screenshots (spec 14) into one labeled sheet
per state so the owner can compare directions without flipping files. This
is review material, not runtime art: it reads tests/screenshots/ and writes
docs/verification/issue-159-art-direction/compare/.

Usage:
    python3 tools/art/compare.py \
        --states day-clear rain night-lamp bed-swap focus-desk \
        --treatments blockout sr gn
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

LABEL_H = 34
GAP = 10


def sheet(states_dir: Path, state: str, treatments: list[str], out: Path) -> bool:
    frames = []
    for treatment in treatments:
        src = states_dir / f"159-{treatment}-{state}.png"
        if not src.exists():
            print(f"  missing {src}", file=sys.stderr)
            return False
        frames.append((treatment, Image.open(src).convert("RGB")))
    width = max(img.width for _, img in frames)
    height = max(img.height for _, img in frames)
    canvas = Image.new("RGB", (width, (LABEL_H + height) * len(frames) + GAP), (16, 16, 20))
    draw = ImageDraw.Draw(canvas)
    y = 0
    for treatment, img in frames:
        draw.rectangle([0, y, width, y + LABEL_H], fill=(28, 24, 36))
        draw.text((12, y + 9), treatment.upper(), fill=(230, 220, 255))
        canvas.paste(img, (0, y + LABEL_H))
        y += LABEL_H + height + GAP
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, optimize=True)
    print(f"  wrote {out}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--screenshots", type=Path, default=Path("tests/screenshots"))
    parser.add_argument("--out", type=Path, default=Path("docs/verification/issue-159-art-direction/compare"))
    parser.add_argument("--states", nargs="+", default=["day-clear", "rain", "night-lamp", "bed-swap", "focus-desk"])
    parser.add_argument("--treatments", nargs="+", default=["blockout", "sr", "gn"])
    args = parser.parse_args()
    ok = all(sheet(args.screenshots, state, args.treatments, args.out / f"compare-{state}.png") for state in args.states)
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
