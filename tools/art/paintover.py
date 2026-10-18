#!/usr/bin/env python3
"""Issue #159 — deterministic paint-over draft for a second treatment.

Honest scope: this is NOT a production art pass. The Gen-AI quota ran out
mid-batch, so the graphic-novel direction ships as (a) the layers that were
really generated in that style and (b) a deterministic paint-over of the
stylized-realism layers, so the runtime comparison can still show the
direction's palette, contrast and line behavior at identical framing. Every
draft layer is labeled as such in the evidence doc and in the QA bar; the
owner's selection gate must not mistake a draft for finished art.

Two modes, because a room shell and a prop need different treatment:

    architecture  palette grade toward the treatment's wall/floor colors,
                  mid posterize, ink lines, low-key vignette
    prop          desaturate + darken toward the noir palette, ink lines;
                  never a palette grade, or every object turns violet

Alpha is always preserved so the matte contract from mat.py survives.

Usage:
    python3 tools/art/paintover.py --src spike_desk_sr.png --treatment gn \
        --out spike_desk_gn.png [--mode prop|architecture]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent


def parse_hex(value: str) -> np.ndarray:
    digits = value.lstrip("#")
    return np.array([int(digits[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def posterize(rgb: np.ndarray, steps: int, blend: float) -> np.ndarray:
    """Quantize lighting into hard shapes, partially blended so material
    detail survives: a full quantize reads as a broken texture, not a style."""
    q = np.floor(rgb / (256.0 / steps)) * (255.0 / (steps - 1))
    return rgb * (1.0 - blend) + q * blend


def ink_lines(rgb: np.ndarray, threshold: float, strength: float) -> np.ndarray:
    """Sobel magnitude edges darkened toward black: bold ink outlines."""
    from scipy.signal import convolve2d

    lum = (rgb @ np.array([0.2126, 0.7152, 0.0722])) / 255.0
    kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=float) / 4.0
    ky = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=float) / 4.0
    mag = np.hypot(
        convolve2d(lum, kx, mode="same", boundary="symm"),
        convolve2d(lum, ky, mode="same", boundary="symm"),
    )
    ink = np.clip((mag - threshold) * strength, 0.0, 1.0)
    return rgb * (1.0 - ink[..., None])


def palette_grade(rgb: np.ndarray, alpha: np.ndarray, target: np.ndarray, amount: float, brightness: float) -> np.ndarray:
    """Shift the plate's hue toward the treatment palette, preserving its own
    light structure.

    A luminance-ramp remap looks tempting but destroys the plate: it squeezes
    ceiling, wall and floor into one dark band and reads as a broken texture.
    A white-balance gain does the opposite — it moves the average color to the
    target while keeping every relative highlight and shadow, which is exactly
    what a paint-over pass should do. The gain is normalized so overall
    luminance is preserved (then scaled by `brightness`), so a noir palette
    darkens only as much as asked, not as a side effect of recoloring.
    """
    opaque = alpha > 127
    if not opaque.any():
        return rgb
    luma = np.array([0.2126, 0.7152, 0.0722])
    src_mean = rgb[opaque].mean(axis=0)
    scale = float(src_mean @ luma) / max(float(target @ luma), 1.0) * brightness
    gain = np.clip((target * scale) / np.maximum(src_mean, 1.0), 0.35, 2.2)
    graded = rgb * gain
    return rgb * (1.0 - amount) + graded * amount


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--src", required=True, type=Path, help="layer PNG from the base treatment")
    parser.add_argument("--treatment", required=True, help="treatment id in treatments.json")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--manifest", type=Path, default=HERE / "treatments.json")
    parser.add_argument("--mode", choices=("prop", "architecture"), default="prop")
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    treatment = manifest["treatments"].get(args.treatment)
    if not treatment:
        print(f"ERROR: treatment '{args.treatment}' not in manifest", file=sys.stderr)
        return 2
    palette = treatment["palette"]

    img = Image.open(args.src).convert("RGBA")
    arr = np.asarray(img, dtype=float)
    alpha = arr[..., 3]
    rgb = arr[..., :3]

    if args.mode == "architecture":
        # A direction draft must stay READABLE: recolor toward the treatment's
        # wall tone without crushing the plate's own lighting, then hint the
        # posterized shapes and ink edges the finished pass will carry.
        rgb = palette_grade(
            rgb, alpha,
            target=parse_hex(palette["wall"]),
            amount=0.6,
            brightness=0.92,
        )
        rgb = posterize(rgb, steps=5, blend=0.45)
        rgb = ink_lines(rgb, threshold=0.14, strength=1.2)
        w, h = img.size
        vig = Image.new("L", (w, h), 0)
        ImageDraw.Draw(vig).ellipse([-w * 0.3, -h * 0.4, w * 1.3, h * 1.4], fill=255)
        vig = np.asarray(vig.filter(ImageFilter.GaussianBlur(min(w, h) // 5)), dtype=float) / 255.0
        rgb = rgb * (0.84 + 0.16 * vig[..., None])
    else:
        # Props: keep their own hues, just darker, flatter and inked. A
        # palette grade here would paint every object in wall color.
        rgb = rgb * 0.86
        lum = (rgb @ np.array([0.2126, 0.7152, 0.0722]))[..., None]
        rgb = rgb * 0.5 + lum * 0.5  # desaturate toward the noir palette
        rgb = posterize(rgb, steps=6, blend=0.4)
        rgb = ink_lines(rgb, threshold=0.12, strength=1.8)

    out = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha.astype(np.uint8)])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out, "RGBA").save(args.out)
    print(f"  draft {args.out} ({args.mode} paint-over of {args.src.name}, treatment {args.treatment})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
