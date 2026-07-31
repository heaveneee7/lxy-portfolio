from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "illustrations" / "cat-motion-v7.png"
OUTPUT = ROOT / "public" / "assets" / "illustrations" / "cat-motion-v7"
NAMES = (
    "crouch",
    "anticipate",
    "push-off",
    "ascent",
    "stretch",
    "apex",
    "descent",
    "tuck",
    "contact",
    "compress",
    "settle",
    "groom",
)

COLS = 4
ROWS = 3
CANVAS = (512, 384)
MAX_SUBJECT = (444, 314)
BASELINE_Y = 358


def main() -> None:
    sheet = Image.open(SOURCE).convert("RGBA")
    OUTPUT.mkdir(parents=True, exist_ok=True)

    for index, name in enumerate(NAMES):
        col = index % COLS
        row = index // COLS
        left = round(col * sheet.width / COLS)
        right = round((col + 1) * sheet.width / COLS)
        top = round(row * sheet.height / ROWS)
        bottom = round((row + 1) * sheet.height / ROWS)
        cell = sheet.crop((left, top, right, bottom))
        alpha_box = cell.getchannel("A").getbbox()
        if alpha_box is None:
            raise RuntimeError(f"Frame {name} is empty")

        subject = cell.crop(alpha_box)
        scale = min(
            MAX_SUBJECT[0] / subject.width,
            MAX_SUBJECT[1] / subject.height,
            1.0,
        )
        if scale < 1:
            subject = subject.resize(
                (round(subject.width * scale), round(subject.height * scale)),
                Image.Resampling.LANCZOS,
            )

        canvas = Image.new("RGBA", CANVAS)
        x = round((CANVAS[0] - subject.width) / 2)
        y = BASELINE_Y - subject.height
        canvas.alpha_composite(subject, (x, y))
        canvas.save(OUTPUT / f"cat-{index + 1:02d}-{name}.png", optimize=True)


if __name__ == "__main__":
    main()
