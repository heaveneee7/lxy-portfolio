from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "illustrations" / "cat-sequence-v6.png"
OUTPUT = ROOT / "public" / "assets" / "illustrations" / "cat-frames-v6"
NAMES = ("crouch", "takeoff", "apex", "landing", "groom", "yawn")


def main() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    cell_width = image.width / len(NAMES)

    for index, name in enumerate(NAMES):
        left = round(index * cell_width)
        right = round((index + 1) * cell_width)
        cell = image.crop((left, 0, right, image.height))
        alpha_box = cell.getchannel("A").getbbox()
        if alpha_box is None:
            raise RuntimeError(f"Frame {name} is empty")
        subject = cell.crop(alpha_box)
        padding = max(18, round(max(subject.size) * 0.055))
        canvas = Image.new("RGBA", (subject.width + padding * 2, subject.height + padding * 2))
        canvas.alpha_composite(subject, (padding, padding))
        canvas.save(OUTPUT / f"cat-{index + 1:02d}-{name}.png", optimize=True)


if __name__ == "__main__":
    main()
