import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(OUT, exist_ok=True)

BLUE = (37, 99, 235, 255)
WHITE = (255, 255, 255, 255)


def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BLUE)

    cx = size / 2.0

    def tri(points):
        d.polygon(points, fill=WHITE)

    # центральный треугольник "play"
    ph = size * 0.36
    pw = size * 0.30
    x0 = cx - pw * 0.35
    tri([(x0, cx - ph / 2), (x0, cx + ph / 2), (x0 + pw, cx)])

    # двойные шевроны слева (назад)
    lx = size * 0.17
    ch = size * 0.11
    cw = size * 0.075
    for i in range(2):
        xx = lx - i * cw * 1.25
        tri([(xx + cw, cx - ch), (xx + cw, cx + ch), (xx, cx)])

    # двойные шевроны справа (вперёд)
    rx = size * 0.83
    for i in range(2):
        xx = rx + i * cw * 1.25
        tri([(xx - cw, cx - ch), (xx - cw, cx + ch), (xx, cx)])

    return img


for s in (16, 48, 128):
    make_icon(s).save(os.path.join(OUT, "icon%d.png" % s))
    print("wrote icon%d.png" % s)
