# Вклеює скрін застосунку в екран телефона на фото героя /pre-reg-form-consult.
# Запускати з кореня репозиторію: python assets-src/consult-phone-screen.py
#
# Кути екрана рахуються не «на око», а як перетини чотирьох граней. Кожна грань —
# пряма, підігнана по темній рамці телефона: для лівої й правої беремо внутрішній
# край бічної рамки, для верхньої й нижньої — де закінчується чорна смуга корпусу.
# Так чотирикутник лягає рівно на екран, і під скріном не лишається смужок старого кадру.
#
# Потрібні Pillow і numpy. Якщо міняється скрін застосунку, досить покласти новий
# consult-phone-screen.png і запустити знову.
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERO = os.path.join(ROOT, "assets-src", "consult-hero-original.webp")
MOCK = os.path.join(ROOT, "assets-src", "consult-phone-screen.png")
OUT = os.path.join(ROOT, "public", "assets", "img", "consult-hero.webp")

# де в макеті скріна закінчується корпус телефона і починається сам екран
MOCK_SCREEN = (102, 100, 468, 926)

hero = Image.open(HERO).convert("RGB")
a = np.asarray(hero).astype(np.int16)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
dark = (r < 75) & (g < 75) & (b < 75)
H, W = dark.shape


def fit(pts):
    """Пряма через точки методом найменших квадратів: повертає (нахил, зсув)."""
    n = len(pts)
    sx = sum(p[0] for p in pts); sy = sum(p[1] for p in pts)
    sxx = sum(p[0] * p[0] for p in pts); sxy = sum(p[0] * p[1] for p in pts)
    m = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    return m, (sy - m * sx) / n


def edge_run(col_or_row, start, step, vertical=True):
    """Довжина суцільної темної смуги від краю рамки всередину."""
    i = start
    while 0 <= i < (H if vertical else W) and (dark[i, col_or_row] if vertical else dark[col_or_row, i]):
        i += step
    return i


# бічні грані: у кожному рядку беремо темну смугу рамки зліва і справа від екрана
left_pts, right_pts = [], []
for y in range(130, 600, 10):
    # шукаємо рамку у вузькому вікні навколо очікуваного місця: нижче пояса
    # в кадр лізе темний піджак, і без вікна найтемніше знаходиться саме він
    for pts, guess in ((left_pts, 0.252 * y + 702), (right_pts, 0.277 * y + 954)):
        lo, hi = int(guess) - 30, int(guess) + 30
        xs = np.nonzero(dark[y, lo:hi])[0] + lo
        if not len(xs):
            continue
        pts.append((y, edge_run(y, xs.min(), 1, vertical=False) if pts is left_pts else xs.min()))
mL, cL = fit(left_pts)      # x = mL*y + cL — перший піксель екрана зліва
mR, cR = fit(right_pts)     # x = mR*y + cR — перший піксель рамки справа

# верхня й нижня грані: у кожному стовпці шукаємо, де закінчується чорна смуга корпусу
top_pts, bot_pts = [], []
for x in range(770, 960, 15):
    ys = np.nonzero(dark[20:300, x])[0] + 20
    if len(ys):
        top_pts.append((x, edge_run(x, ys.min(), 1)))
for x in range(880, 1090, 15):
    ys = np.nonzero(dark[400:700, x])[0] + 400
    if len(ys):
        bot_pts.append((x, edge_run(x, ys.max(), -1)))
mT, cT = fit(top_pts)       # y = mT*x + cT
mB, cB = fit(bot_pts)       # y = mB*x + cB


def cross(mx, cx, my, cy):
    """Перетин вертикальної грані x = mx*y + cx з горизонтальною y = my*x + cy."""
    y = (my * cx + cy) / (1 - my * mx)
    return np.array([mx * y + cx, y])


tl, tr = cross(mL, cL, mT, cT), cross(mR, cR, mT, cT)
br, bl = cross(mR, cR, mB, cB), cross(mL, cL, mB, cB)
quad = [tl, tr, br, bl]
# на пів-пікселя назовні, щоб по краю не лишилось волосини старого кадру
mid = sum(quad) / 4
quad = [c + (c - mid) * 0.004 for c in quad]
print("кути екрана:", [tuple(c.round().astype(int)) for c in quad])

mock = Image.open(MOCK).convert("RGB").crop(MOCK_SCREEN)
mw, mh = mock.size

# коефіцієнти PIL перетворюють координату виходу в координату входу, тому пари йдуть dst -> src
A, B = [], []
for (dx, dy), (sx, sy) in zip(quad, [(0, 0), (mw, 0), (mw, mh), (0, mh)]):
    A.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]); B.append(sx)
    A.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]); B.append(sy)
coeffs = np.linalg.solve(np.array(A, float), np.array(B, float))
warped = mock.transform(hero.size, Image.PERSPECTIVE, coeffs, Image.BICUBIC)

# Малюємо тільки там, де екран справді видно: чотирикутник мінус пальці.
# Шкіра — червоний більший за зелений, зелений за синій; екран під це не підпадає.
shape = Image.new("L", (W * 2, H * 2), 0)
ImageDraw.Draw(shape).polygon([tuple(c * 2) for c in quad], fill=255)
inside = np.asarray(shape.resize((W, H), Image.BILINEAR)) > 127
skin = (r > 110) & (r > g + 8) & (g > b + 4)
m = Image.fromarray(((inside & ~skin) * 255).astype(np.uint8), "L")
# дрібні дірки від підсвічених країв старого напису закриваємо, пальці лишаються
m = m.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.MinFilter(11))
m = m.filter(ImageFilter.GaussianBlur(0.6))

out = hero.copy()
out.paste(warped, (0, 0), m)
out.save(OUT, "WEBP", quality=88, method=6)
print("готово:", OUT)
