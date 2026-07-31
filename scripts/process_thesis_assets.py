from pathlib import Path
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(r"D:\ChatGPT Project\portfolio-site-6.0")
OUT = ROOT / "public" / "assets" / "thesis"
TEMP = Path(r"C:\Users\19379\AppData\Local\Temp")


def crop_rgba(image: Image.Image, pad: int = 16) -> Image.Image:
    alpha = np.asarray(image.getchannel("A"))
    ys, xs = np.where(alpha > 3)
    if not len(xs):
        return image
    box = (
        max(int(xs.min()) - pad, 0),
        max(int(ys.min()) - pad, 0),
        min(int(xs.max()) + pad + 1, image.width),
        min(int(ys.max()) + pad + 1, image.height),
    )
    return image.crop(box)


def extract_crystal_text(source: Path, target: Path) -> None:
    """Keep the supplied glass lettering, removing only its near-white field."""
    image = Image.open(source).convert("RGB")
    rgb = np.asarray(image, dtype=np.float32)
    saturation = rgb.max(axis=2) - rgb.min(axis=2)
    darkness = 255.0 - rgb.mean(axis=2)
    pink = rgb[..., 0] - (rgb[..., 1] + rgb[..., 2]) * 0.5

    # Strong pink pixels define the actual glyphs. A restrained dilation retains
    # the pale internal highlights and soft shadow without admitting paper noise.
    core = ((saturation > 7.5) & (pink > 2.0) & (darkness > 2.0)).astype(np.uint8) * 255
    support = Image.fromarray(core).filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.GaussianBlur(1.2))
    support = np.asarray(support, dtype=np.float32) / 255.0
    signal = np.maximum((saturation - 1.5) * 22.0, (darkness - 2.4) * 13.0)
    alpha = np.clip(signal, 0.0, 255.0) * support
    alpha[alpha < 9] = 0

    rgba = np.dstack((rgb, alpha)).astype(np.uint8)
    result = crop_rgba(Image.fromarray(rgba, "RGBA"), 26)
    result.save(target)


def extract_flower(source: Path, target: Path) -> Image.Image:
    """Extract only the pastel line drawing from its very pale blue paper."""
    image = Image.open(source).convert("RGB")
    rgb = np.asarray(image, dtype=np.float32)
    saturation = rgb.max(axis=2) - rgb.min(axis=2)
    darkness = 255.0 - rgb.mean(axis=2)
    # Background: sat≈10, dark≈6. The authored line is either more saturated or darker.
    signal = np.maximum((saturation - 13.0) * 8.0, (darkness - 13.0) * 9.0)
    alpha = np.clip(signal, 0.0, 255.0)
    alpha[alpha < 12] = 0
    alpha = np.asarray(Image.fromarray(alpha.astype(np.uint8)).filter(ImageFilter.GaussianBlur(.35)))
    rgba = np.dstack((rgb, alpha)).astype(np.uint8)
    result = crop_rgba(Image.fromarray(rgba, "RGBA"), 16)
    result.save(target)
    return result


def extract_heart(source: Path, target: Path) -> Image.Image:
    """Extract the supplied white continuous heart line from the pastel field."""
    image = Image.open(source).convert("RGBA")
    arr = np.asarray(image, dtype=np.float32)
    rgb, src_alpha = arr[..., :3], arr[..., 3]
    luminance = rgb.mean(axis=2)
    saturation = rgb.max(axis=2) - rgb.min(axis=2)
    # The line is near-white and neutral; the field is much more chromatic/darker.
    signal = np.minimum((luminance - 226.0) * 14.0, (17.0 - saturation) * 18.0)
    alpha = np.clip(signal, 0.0, 255.0) * (src_alpha / 255.0)
    alpha[alpha < 14] = 0
    # Remap the white line to the shared blue–violet–pink palette.
    h, w = alpha.shape
    x = np.linspace(0, 1, w, dtype=np.float32)
    colors = np.array([[143, 193, 222], [183, 166, 215], [220, 151, 194], [239, 179, 164]], dtype=np.float32)
    pos = x * (len(colors) - 1)
    idx = np.minimum(pos.astype(int), len(colors) - 2)
    frac = pos - idx
    row = colors[idx] * (1 - frac[:, None]) + colors[idx + 1] * frac[:, None]
    color = np.repeat(row[None, :, :], h, axis=0)
    rgba = np.dstack((color, alpha)).astype(np.uint8)
    result = crop_rgba(Image.fromarray(rgba, "RGBA"), 18)
    result.save(target)
    return result


def extract_rose(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGB")
    rgb = np.asarray(image, dtype=np.float32)
    darkness = 255.0 - rgb.mean(axis=2)
    alpha = np.clip((darkness - 5.0) * 5.5, 0.0, 255.0)
    alpha[alpha < 10] = 0
    rgba = np.dstack((rgb, alpha)).astype(np.uint8)
    crop_rgba(Image.fromarray(rgba, "RGBA"), 22).save(target)


def gradient_color(t: float) -> tuple[int, int, int, int]:
    colors = np.array([[239, 181, 166], [221, 160, 196], [190, 174, 220], [146, 196, 222]], dtype=float)
    p = max(0.0, min(1.0, t)) * (len(colors) - 1)
    i = min(int(p), len(colors) - 2)
    f = p - i
    rgb = colors[i] * (1 - f) + colors[i + 1] * f
    return int(rgb[0]), int(rgb[1]), int(rgb[2]), 225


def build_continuous_thread(flower: Image.Image, heart: Image.Image, target: Path) -> None:
    """One raster asset: supplied flower → curved thread → supplied complex heart."""
    canvas = Image.new("RGBA", (2400, 920), (0, 0, 0, 0))
    flower.thumbnail((430, 430), Image.Resampling.LANCZOS)
    heart.thumbnail((610, 500), Image.Resampling.LANCZOS)
    flower_xy = (20, 470)
    heart_xy = (1770, 25)
    canvas.alpha_composite(flower, flower_xy)

    # A sampled cubic Bezier becomes a genuine raster line; no SVG is emitted.
    draw = ImageDraw.Draw(canvas, "RGBA")
    # The supplied flower has a drawn strand exiting at its upper-right edge.
    # Continue from that exact visual exit so the whole composition reads as one line.
    p0 = (flower_xy[0] + flower.width - 5, flower_xy[1] + int(flower.height * .095))
    p1, p2 = (720, 315), (1320, 690)
    p3 = (heart_xy[0] + 22, heart_xy[1] + int(heart.height * .66))
    points = []
    steps = 420
    for n in range(steps + 1):
        t = n / steps
        u = 1 - t
        x = u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0]
        y = u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]
        points.append((x, y))
    for i in range(len(points) - 1):
        draw.line([points[i], points[i + 1]], fill=gradient_color(i / (len(points)-1)), width=7)
    canvas.alpha_composite(heart, heart_xy)
    canvas.save(target)


def crop_bow(source: Path, target: Path, box: tuple[int, int, int, int]) -> None:
    image = Image.open(source).convert("RGBA").crop(box)
    crop_rgba(image, 0).save(target)


def build_satin_frame(source: Path, target: Path, size: tuple[int, int]) -> None:
    """Recompose the supplied portrait frame into a landscape PNG with a transparent centre.

    Corners are never stretched. Only the straight satin rails are resized along their
    own axis, so the bow/cherry and fabric folds keep their authored proportions.
    """
    image = crop_rgba(Image.open(source).convert("RGBA"), 0)
    sw, sh = image.size
    width, height = size
    corner = 230
    rail = 112
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))

    tl = image.crop((0, 0, corner, corner))
    tr = image.crop((sw - corner, 0, sw, corner))
    bl = image.crop((0, sh - corner, corner, sh))
    br = image.crop((sw - corner, sh - corner, sw, sh))
    top = image.crop((corner, 0, sw - corner, rail))
    bottom = image.crop((corner, sh - rail, sw - corner, sh))
    left = image.crop((0, corner, rail, sh - corner))
    right = image.crop((sw - rail, corner, sw, sh - corner))

    canvas.alpha_composite(top.resize((width - corner * 2, rail), Image.Resampling.LANCZOS), (corner, 0))
    canvas.alpha_composite(bottom.resize((width - corner * 2, rail), Image.Resampling.LANCZOS), (corner, height - rail))
    canvas.alpha_composite(left.resize((rail, height - corner * 2), Image.Resampling.LANCZOS), (0, corner))
    canvas.alpha_composite(right.resize((rail, height - corner * 2), Image.Resampling.LANCZOS), (width - rail, corner))
    canvas.alpha_composite(tl, (0, 0))
    canvas.alpha_composite(tr, (width - corner, 0))
    canvas.alpha_composite(bl, (0, height - corner))
    canvas.alpha_composite(br, (width - corner, height - corner))
    canvas.save(target)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    extract_crystal_text(TEMP / "codex-clipboard-f01d19f3-b680-4c47-aed2-6dffaefaf403.png", OUT / "crystal-thesis-entry.png")
    extract_rose(TEMP / "codex-clipboard-91fabe77-9c03-4377-9cea-be91174f0beb.png", OUT / "halftone-rose-cutout.png")
    flower = extract_flower(TEMP / "codex-clipboard-58ea3259-2459-4595-bfaa-bdb6a658e461.png", OUT / "line-flower-cutout.png")
    heart = extract_heart(TEMP / "codex-clipboard-20080869-6600-4837-a5b0-d011c362dfb8.png", OUT / "line-heart-cutout.png")
    build_continuous_thread(flower, heart, OUT / "research-thread-raster.png")
    build_satin_frame(OUT / "satin-bow-frame.png", OUT / "satin-frame-paths.png", (1642, 1066))
    build_satin_frame(OUT / "satin-bow-frame.png", OUT / "satin-frame-rb.png", (1603, 1192))

    pearl = OUT / "pearl-bow-frame.png"
    with Image.open(pearl) as image:
        w, h = image.size
    crop_bow(pearl, OUT / "pearl-bow-top.png", (int(w * .55), int(h * .05), w, int(h * .36)))
    crop_bow(pearl, OUT / "pearl-bow-bottom.png", (int(w * .53), int(h * .66), w, int(h * .96)))


if __name__ == "__main__":
    main()
