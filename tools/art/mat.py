#!/usr/bin/env python3
"""Issue #159 — production matte/composite pass for the art-direction comparison.

Canonical production method (docs/14 §4):

    3D blockout or shared spatial reference   -> the existing spike SVG layers
    authored cameras                          -> fixed 1600x900 framing
    reference renders / masks                 -> this tool's --ref output
    Gen-AI or paint-over                      -> ImageGen passes (external)
    layered 2D assets                         -> this tool's keyed PNG output
    Phaser                                    -> unchanged generic runtime

This script owns only the deterministic post-generation steps: chroma-key the
generated sprite, clean the matte, trim to content, then fit it into the
EXACT intrinsic frame of the blockout layer it replaces so the authored
projection geometry (normalized width/height) keeps its meaning and the
treatment swaps art without moving anything.

Usage:
    python3 tools/art/mat.py --src gen.png --blockout layer.svg --out out.png
    python3 tools/art/mat.py --src gen.png --frame 300x220 --out out.png [--pad 6]
                             [--key auto|none|black|#rrggbb] [--spill-margin 0.15]
                             [--alpha-floor 8] [--alpha 1.0] [--align bottom|center]

Exit code is non-zero when the matte comes back empty or the content does not
fit the authored frame, so a batch run cannot silently ship a bad layer.
"""

from __future__ import annotations

import argparse
import io
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# The generated sprites are requested on a flat magenta key. Magenta is used
# because it appears nowhere in a 2005 motel interior palette and is far from
# both skin tones and wood/fabric hues.
DEFAULT_KEY = np.array([255.0, 0.0, 255.0])


def parse_hex(value: str) -> np.ndarray:
    match = re.fullmatch(r"#?([0-9a-fA-F]{6})", value)
    if not match:
        raise argparse.ArgumentTypeError(f"expected #rrggbb, got '{value}'")
    digits = match.group(1)
    return np.array([int(digits[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def rasterize(svg_path: Path, width: int, height: int) -> Image.Image:
    """Rasterize a blockout SVG at its authored frame size.

    ImageMagick's internal MSVG renderer is not trustworthy here (it drops SVG
    masks and leaves prop centers transparent), and Pillow has no SVG support
    at all, so the shared spatial reference is rasterized with cairosvg.
    """
    try:
        import cairosvg
    except ImportError as error:  # pragma: no cover - tooling dependency
        raise SystemExit(f"cairosvg is required to rasterize {svg_path}: {error}")
    png = cairosvg.svg2png(url=str(svg_path), output_width=width, output_height=height)
    return Image.open(io.BytesIO(png)).convert("RGBA").resize(
        (width, height), Image.LANCZOS
    )


def blockout_frame(svg_path: Path) -> tuple[int, int]:
    """Read the intrinsic width/height of the blockout layer being replaced."""
    head = svg_path.read_text(encoding="utf-8")[:2000]
    width = re.search(r'\bwidth="(\d+(?:\.\d+)?)"', head)
    height = re.search(r'\bheight="(\d+(?:\.\d+)?)"', head)
    if not width or not height:
        raise ValueError(f"{svg_path}: no intrinsic width/height found")
    return int(float(width.group(1))), int(float(height.group(1)))


def auto_key(rgb: np.ndarray) -> np.ndarray:
    """Sample the border band so a drifted model key still keys cleanly."""
    band = np.concatenate([
        rgb[0:16].reshape(-1, 3),
        rgb[-16:].reshape(-1, 3),
        rgb[:, 0:16].reshape(-1, 3),
        rgb[:, -16:].reshape(-1, 3),
    ])
    median = np.median(band, axis=0)
    spread = float(np.max(band.std(axis=0)))
    print(f"  auto key: rgb({median[0]:.0f},{median[1]:.0f},{median[2]:.0f}) border spread {spread:.1f}")
    return median


def clean_matte(alpha: np.ndarray, floor: int) -> np.ndarray:
    """Drop speckle below the floor, then close 1px pinholes inside the body."""
    mask = alpha >= floor
    # Remove small islands: keep the largest connected component plus any
    # component that is at least 5% of it (props are sometimes two-part).
    from scipy import ndimage

    labels, count = ndimage.label(mask)
    if count == 0:
        return alpha
    sizes = ndimage.sum(mask, labels, index=np.arange(1, count + 1))
    biggest = float(sizes.max())
    keep = {i + 1 for i, size in enumerate(sizes) if size >= max(biggest * 0.05, 64)}
    cleaned = np.isin(labels, list(keep)) * alpha
    cleaned = ndimage.binary_closing(cleaned > 0, structure=np.ones((3, 3))) * 255
    # Restore graded alpha inside the kept region so edges stay soft.
    out = np.where(cleaned > 0, np.maximum(alpha, 0), 0).astype(np.uint8)
    return out


def trim(alpha: np.ndarray, pad: int) -> tuple[slice, slice]:
    rows = np.where(alpha.max(axis=1) > 0)[0]
    cols = np.where(alpha.max(axis=0) > 0)[0]
    if rows.size == 0 or cols.size == 0:
        raise ValueError("matte is empty after keying")
    top, bottom = int(rows[0]), int(rows[-1]) + 1
    left, right = int(cols[0]), int(cols[-1]) + 1
    h, w = alpha.shape
    return (
        slice(max(top - pad, 0), min(bottom + pad, h)),
        slice(max(left - pad, 0), min(right + pad, w)),
    )


def unmix(rgb: np.ndarray, key: np.ndarray, margin: float) -> tuple[np.ndarray, np.ndarray]:
    """Recover the sprite's true color and alpha from a chroma plate.

    A composited pixel is obs = a*true + (1-a)*key. The key's channels carry
    no sprite information, so the cast fraction f = 1 - a is measurable
    directly: how far the key-dominant channels exceed the others, normalized
    by the same gap on the key color itself. The sprite's real color is then
    (obs - f*key) / (1 - f).

    This replaces a distance-ramp matte, which saturates long before the cast
    is gone and leaves fine detail (foliage, hair) with a purple haze: the
    ramp calls a 60%-magenta leaf edge "opaque", while f knows it is 60% key.

    `margin` declares how much key-hue belongs to the sprite itself. A
    dusty-rose quilt measures a small f on its own, so anything up to margin
    is treated as the sprite's color, not as mixing, and neither alpha nor
    color recovery touches it.
    """
    key_channels = [i for i in range(3) if key[i] > 127]
    other_channels = [i for i in range(3) if i not in key_channels]
    if not key_channels or not other_channels:
        return rgb, np.full(rgb.shape[:2], 255, dtype=np.uint8)
    key_dominant = rgb[:, :, key_channels].min(axis=2)
    other_dominant = rgb[:, :, other_channels].max(axis=2)
    denom = max(
        min(key[i] for i in key_channels) - max(key[i] for i in other_channels), 1.0
    )
    f = np.clip((key_dominant - other_dominant) / denom, 0.0, 1.0)
    f = np.clip((f - margin) / max(1.0 - margin, 0.01), 0.0, 1.0)
    true_rgb = (rgb - f[..., None] * key) / np.maximum(1.0 - f, 0.05)[..., None]
    alpha = ((1.0 - f) * 255.0).astype(np.uint8)
    return np.clip(true_rgb, 0.0, 255.0), alpha


def fit_into_frame(
    rgba: Image.Image, frame_w: int, frame_h: int, align: str, cover: bool = False
) -> Image.Image:
    """Scale to fit the authored frame without distortion, then align it."""
    src_w, src_h = rgba.size
    if cover:
        # Full-frame layers (fabric strips, exterior plates) are meant to fill
        # their frame; contain-fit would letterbox them.
        scale = max(frame_w / src_w, frame_h / src_h)
    else:
        scale = min(frame_w / src_w, frame_h / src_h)
        if scale > 1.0:
            # Never upscale past the generated resolution by more than 1.5x;
            # the blockout frames are small and upscaling would smear the
            # paint pass.
            scale = min(scale, 1.5)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    scaled = rgba.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    x = (frame_w - new_w) // 2
    if align == "bottom":
        y = frame_h - new_h
    elif align == "top":
        y = 0
    else:
        y = (frame_h - new_h) // 2
    canvas.alpha_composite(scaled, (x, y))
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--src", required=True, type=Path, help="generated sprite (chroma background)")
    parser.add_argument("--out", required=True, type=Path, help="keyed PNG written at the authored frame size")
    parser.add_argument("--blockout", type=Path, help="blockout SVG whose intrinsic frame is reused")
    parser.add_argument("--frame", help="explicit WxH frame, when no blockout SVG applies")
    parser.add_argument("--ref", type=Path, help="optional side-by-side reference render (blockout | keyed)")
    parser.add_argument("--key", default="auto", help="'auto' (border sample), 'none' (full-frame plate), 'black' (luminance matte), or #rrggbb")
    parser.add_argument("--spill-margin", type=float, default=0.15, help="fraction of key hue declared to belong to the sprite itself (rose/pink art needs 0.2+)")
    parser.add_argument("--alpha-floor", type=int, default=8)
    parser.add_argument("--alpha", type=float, default=1.0, help="scale final alpha (0.35 ≈ glass plate over an already-keyed layer)")
    parser.add_argument("--pad", type=int, default=6, help="transparent margin kept around content")
    parser.add_argument("--align", choices=("bottom", "center", "top"), default="center")
    args = parser.parse_args()

    if not args.blockout and not args.frame:
        parser.error("provide --blockout or --frame")
    if args.blockout:
        frame_w, frame_h = blockout_frame(args.blockout)
    else:
        match = re.fullmatch(r"(\d+)x(\d+)", args.frame or "")
        if not match:
            parser.error("--frame must look like 300x220")
        frame_w, frame_h = int(match.group(1)), int(match.group(2))

    source = Image.open(args.src).convert("RGB")
    rgb = np.asarray(source, dtype=float)
    if args.key == "none":
        # Full-frame layers (curtain fabric strip, exterior plate, glass tint)
        # carry no chroma background; they only need the deterministic
        # cover-fit.
        alpha = np.full(rgb.shape[:2], 255, dtype=np.uint8)
        rows = slice(0, rgb.shape[0])
        cols = slice(0, rgb.shape[1])
        coverage = 100.0
    elif args.key == "black":
        # Emissive plates are generated on pure black: luminance IS alpha,
        # so the glow core stays opaque and the falloff stays graded.
        lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
        alpha = np.clip(lum * 2.2, 0, 255).astype(np.uint8)
        rows = slice(0, rgb.shape[0])
        cols = slice(0, rgb.shape[1])
        coverage = float((alpha > args.alpha_floor).mean()) * 100.0
        print(f"  luminance matte coverage {coverage:.1f}%")
        if coverage < 0.5:
            print("ERROR: plate is black; nothing to glow.", file=sys.stderr)
            return 2
    else:
        key = DEFAULT_KEY if args.key == "auto" else parse_hex(args.key)
        if args.key == "auto":
            key = auto_key(rgb)
        rgb, alpha = unmix(rgb, key, margin=args.spill_margin)
        alpha = clean_matte(alpha, args.alpha_floor)
        rows, cols = trim(alpha, args.pad)
        coverage = float((alpha > args.alpha_floor).mean()) * 100.0
        print(f"  matte coverage {coverage:.1f}%  content {cols.stop - cols.start}x{rows.stop - rows.start}")
        if coverage < 0.5:
            print("ERROR: matte covers almost nothing; keying failed.", file=sys.stderr)
            return 2

    rgba = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha])
    cut = Image.fromarray(rgba, "RGBA").crop((cols.start, rows.start, cols.stop, rows.stop))
    fitted = fit_into_frame(cut, frame_w, frame_h, args.align, cover=args.key == "none")
    if args.alpha != 1.0:
        # Semi-transparent plates (window glass over the keyed exterior, the
        # additive lamp glow) keep the keyed matte but lose opacity. The
        # runtime draws them as normal props, so the transparency must live
        # in the texture itself.
        a = fitted.getchannel("A").point(lambda v: int(v * args.alpha))
        fitted.putalpha(a)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    fitted.save(args.out)
    print(f"  wrote {args.out} ({frame_w}x{frame_h})")

    if args.ref:
        ref = Image.new("RGBA", (frame_w * 2 + 12, frame_h + 12), (24, 24, 28, 255))
        if args.blockout:
            base = rasterize(args.blockout, frame_w, frame_h)
            ref.alpha_composite(base, (6, 6))
        ref.alpha_composite(fitted, (frame_w + 6, 6))
        args.ref.parent.mkdir(parents=True, exist_ok=True)
        ref.save(args.ref)
        print(f"  wrote {args.ref} (blockout | keyed)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
