#!/usr/bin/env python3
"""Issue #159 — architecture compositor: keep the camera contract non-negotiable.

The architecture layer is the only asset that carries the room's fixed
openings, and every other layer resolves against them (window zone mask,
glass overlay, curtain pin, streak emitter, exterior backplate, door panel).
A generated wall plate is allowed to change paint, wear and lighting; it is
never allowed to move a hole. This tool enforces that mechanically:

    generated wall plate (1600x900-ish, no openings)
      -> cover-fit to the authored frame
      -> punch the canonical opening rects to transparent
      -> draw the treatment's casing over the blockout's fixed frame rects
      -> subtle inner shadow so the hole reads as wall thickness, not a cut

Frames and openings come from tools/art/treatments.json, which is the single
source of truth shared with the documentation and the review pass. Rasterize
the blockout architecture with the same rects and the composite is directly
comparable in --ref.

Usage:
    python3 tools/art/architecture.py --treatment sr --src plate.png \
        --out public/assets/world/starter-spike/sr/spike_architecture_sr.png \
        [--ref /tmp/arch_sr_ref.png]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "treatments.json"


def load_manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def shade(hex_color: str, factor: float) -> tuple[int, int, int]:
    digits = hex_color.lstrip("#")
    rgb = tuple(int(digits[i:i + 2], 16) for i in (0, 2, 4))
    return tuple(max(0, min(255, int(round(c * factor)))) for c in rgb)


def cover_fit(plate: Image.Image, width: int, height: int) -> Image.Image:
    """Scale to cover the authored frame, then center-crop. The plate is an
    empty wall, so a small crop loses nothing but must never letterbox."""
    src_w, src_h = plate.size
    scale = max(width / src_w, height / src_h)
    sized = plate.resize((max(1, int(round(src_w * scale))), max(1, int(round(src_h * scale)))), Image.LANCZOS)
    left = (sized.width - width) // 2
    top = (sized.height - height) // 2
    return sized.crop((left, top, left + width, top + height))


def align_floor_line(plate: Image.Image, plate_floor_y: int, target_floor_y: int) -> Image.Image:
    """Warp the plate so its wall/floor boundary lands on the blockout's.

    The floor line is part of the camera contract: every prop's authored
    y/height assumes the blockout's floor edge (y 640..700 across the frame).
    A generated plate that puts the floor at 762 would make the furniture
    float on the wall, so the band above the line is compressed and the band
    below stretched to meet the contract. This is a paint-over adjustment,
    not a geometry change: openings and casing are composited after it.
    """
    width, height = plate.size
    if not 0 < plate_floor_y < height:
        raise ValueError(f"plate floor line {plate_floor_y} outside frame 0..{height}")
    top = plate.crop((0, 0, width, plate_floor_y)).resize(
        (width, target_floor_y), Image.LANCZOS
    )
    bottom = plate.crop((0, plate_floor_y, width, height)).resize(
        (width, height - target_floor_y), Image.LANCZOS
    )
    out = Image.new("RGB", (width, height))
    out.paste(top, (0, 0))
    out.paste(bottom, (0, target_floor_y))
    return out


def detect_floor_line(plate: Image.Image, search_from: int) -> int:
    """Strongest horizontal color break below the window sill.

    The wall/floor boundary is the hardest horizontal edge in the lower band
    of an openings-free wall shell, but the search must be bounded: an
    unbounded row-gradient peak finds the chair rail (a mid-wall trim line),
    which sits well above the contract floor. The blockout puts its floor
    edge below the window sill, so everything above the sill plus a margin
    is excluded and the remaining peak is the floor.
    """
    import numpy as np

    arr = np.asarray(plate.convert("RGB"), dtype=float)
    rows = arr.mean(axis=1)
    grad = np.linalg.norm(np.diff(rows, axis=0), axis=1)
    lo = min(search_from, arr.shape[0] - 2)
    hi = int(arr.shape[0] * 0.98)
    if hi - lo < 8:
        raise ValueError(f"floor search band {lo}..{hi} too narrow")
    return int(lo + grad[lo:hi].argmax()) + 1


def bake_normal(diffuse: Image.Image, strength: float = 2.0) -> Image.Image:
    """Sobel height->normal bake of the treatment's own diffuse.

    The runtime lights the view background with a linked normal map, so a
    treatment that repaints the architecture must ship its own: the blockout
    normal encodes the blockout's wear, not the generated paint pass. Luminance
    is the height proxy; transparent regions (the punched openings) read as
    flat, so the casing edges get a natural bevel and the holes stay neutral.
    """
    import numpy as np

    rgba = np.asarray(diffuse.convert("RGBA"), dtype=float)
    rgb = rgba[..., :3]
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    lum = np.where(rgba[..., 3] > 127, lum, 0.0)
    kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=float) / 8.0
    ky = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=float) / 8.0
    from scipy.signal import convolve2d

    dx = convolve2d(lum / 255.0, kx, mode="same", boundary="symm") * strength
    dy = convolve2d(lum / 255.0, ky, mode="same", boundary="symm") * strength
    dz = np.ones_like(dx)
    norm = np.sqrt(dx * dx + dy * dy + dz * dz)
    enc = np.stack([(dx / norm + 1) / 2, (-dy / norm + 1) / 2, (dz / norm + 1) / 2], axis=2)
    out = (np.clip(enc, 0, 1) * 255).astype(np.uint8)
    img = Image.fromarray(out, "RGB")
    rgba = Image.new("RGBA", img.size, (0, 0, 0, 0))
    mask = Image.fromarray(((np.asarray(diffuse.convert("RGBA"))[..., 3] > 127) * 255).astype(np.uint8), "L")
    rgba.paste(img, (0, 0), mask)
    return rgba


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--treatment", required=True, help="treatment id in treatments.json (sr | gn)")
    parser.add_argument("--src", required=True, type=Path, help="generated wall plate (openings-free)")
    parser.add_argument("--out", required=True, type=Path, help="composite PNG to write")
    parser.add_argument("--normal-out", type=Path, help="optional linked normal map derived from the composite")
    parser.add_argument("--manifest", type=Path, default=MANIFEST)
    parser.add_argument("--ref", type=Path, help="optional blockout | composite reference render")
    parser.add_argument("--blockout", type=Path, help="blockout architecture SVG for --ref")
    parser.add_argument("--floor", choices=("auto", "off"), default="auto", help="warp the plate's wall/floor line onto the blockout contract line")
    parser.add_argument("--target-floor", type=int, default=670, help="blockout floor line y (mean of its 640..700 slope)")
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    treatment = manifest["treatments"].get(args.treatment)
    if not treatment:
        print(f"ERROR: treatment '{args.treatment}' not in {args.manifest}", file=sys.stderr)
        return 2
    width = manifest["frame"]["width"]
    height = manifest["frame"]["height"]
    openings = manifest["openings"]
    frames = manifest["frames"]
    palette = treatment["palette"]

    plate = cover_fit(Image.open(args.src).convert("RGB"), width, height)
    if args.floor == "auto":
        win = openings["window"]
        search_from = win["y"] + win["h"] + 70  # below the window sill casing
        detected = detect_floor_line(plate, search_from)
        print(f"  floor line: plate y={detected} (search from {search_from}) -> contract y={args.target_floor}")
        plate = align_floor_line(plate, detected, args.target_floor)
    comp = plate.convert("RGBA")
    comp.putalpha(255)

    dark = shade(palette["frame"], 0.55)

    # Inner shadow just inside each opening edge so the punched hole reads as
    # wall thickness rather than a cut in a flat image.
    for rect in openings.values():
        ring = Image.new("L", (width, height), 0)
        rd = ImageDraw.Draw(ring)
        rd.rectangle(
            [rect["x"] - 14, rect["y"] - 14, rect["x"] + rect["w"] + 14, rect["y"] + rect["h"] + 14],
            fill=200,
        )
        rd.rectangle([rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"]], fill=0)
        ring = ring.filter(ImageFilter.GaussianBlur(10))
        shadow_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        shadow_layer.putalpha(ring.point(lambda v: int(v * 0.55)))
        comp.alpha_composite(shadow_layer)

    # Casing: the blockout's fixed frame rects recolored per treatment, with a
    # top bevel and a dark outline so the casing still reads in runtime.
    for group in frames.values():
        for rect in group:
            box = [rect["x"], rect["y"], rect["x"] + rect["w"] - 1, rect["y"] + rect["h"] - 1]
            casing = Image.new("RGBA", (width, height), (0, 0, 0, 0))
            cd = ImageDraw.Draw(casing)
            cd.rectangle(box, fill=(*shade(palette["frame"], 1.0), 255))
            cd.rectangle([box[0], box[1], box[2], box[1] + max(3, rect["h"] // 6)], fill=(*shade(palette["frameLight"], 1.0), 255))
            cd.rectangle(box, outline=(*dark, 255), width=5)
            comp.alpha_composite(casing)

    # Punch the holes last so a casing that overlaps an opening edge (the
    # blockout frames sit outside them, but generated plates can bleed) and
    # the inner glow can never re-cover the opening.
    alpha = comp.getchannel("A")
    ad = ImageDraw.Draw(alpha)
    for rect in openings.values():
        ad.rectangle([rect["x"], rect["y"], rect["x"] + rect["w"] - 1, rect["y"] + rect["h"] - 1], fill=0)
    comp.putalpha(alpha)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    comp.save(args.out)
    print(f"  wrote {args.out} ({width}x{height}, openings {[(r['x'], r['y'], r['w'], r['h']) for r in openings.values()]})")

    if args.normal_out:
        args.normal_out.parent.mkdir(parents=True, exist_ok=True)
        bake_normal(comp).save(args.normal_out)
        print(f"  wrote {args.normal_out} (derived from this treatment's own diffuse)")

    if args.ref:
        from mat import rasterize  # same directory, shared blockout rasterizer

        ref = Image.new("RGBA", (width * 2 + 12, height + 12), (24, 24, 28, 255))
        if args.blockout:
            ref.alpha_composite(rasterize(args.blockout, width, height), (6, 6))
        ref.alpha_composite(comp, (width + 6, 6))
        args.ref.parent.mkdir(parents=True, exist_ok=True)
        ref.save(args.ref)
        print(f"  wrote {args.ref} (blockout | composite)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
