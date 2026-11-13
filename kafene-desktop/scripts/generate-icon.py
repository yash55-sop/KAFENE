"""Regenerate assets/kafene.ico with Pillow 11.0.0."""

from pathlib import Path

from PIL import Image, ImageDraw


SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
SCALE = 8
ESPRESSO = "#392318"
CREAM = "#FFF0D9"
CARAMEL = "#EAA66C"


def box(x1, y1, x2, y2):
    return tuple(v * SCALE for v in (x1, y1, x2, y2))


image = Image.new("RGBA", (256 * SCALE, 256 * SCALE))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle(box(5, 5, 250, 250), 56 * SCALE, fill=ESPRESSO)

# The handle sits behind the cup; the thick shapes stay distinct at 16 px.
draw.rounded_rectangle(box(153, 100, 212, 157), 27 * SCALE, fill=CREAM)
draw.rounded_rectangle(box(162, 113, 199, 144), 15 * SCALE, fill=ESPRESSO)
draw.rounded_rectangle(box(48, 93, 174, 174), 34 * SCALE, fill=CREAM)
draw.rectangle(box(48, 95, 174, 125), fill=CREAM)
draw.ellipse(box(48, 80, 174, 109), fill=CREAM)
draw.ellipse(box(61, 87, 161, 101), fill=CARAMEL)
draw.rounded_rectangle(box(40, 188, 184, 200), 6 * SCALE, fill=CARAMEL)

for x, y in ((93, 45), (121, 35)):
    draw.line(
        [(a * SCALE, b * SCALE) for a, b in ((x, y + 20), (x + 5, y + 11), (x + 1, y))],
        fill=CREAM,
        width=8 * SCALE,
        joint="curve",
    )
    for a, b in ((x, y + 20), (x + 1, y)):
        draw.ellipse(box(a - 4, b - 4, a + 4, b + 4), fill=CREAM)

frames = [image.resize((size, size), Image.Resampling.LANCZOS) for size in SIZES]
target = Path(__file__).resolve().parents[1] / "assets" / "kafene.ico"
target.parent.mkdir(parents=True, exist_ok=True)
frames[-1].save(target, sizes=[frame.size for frame in frames], append_images=frames[:-1])
