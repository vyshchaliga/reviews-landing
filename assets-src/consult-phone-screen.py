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
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERO = os.path.join(ROOT, "assets-src", "consult-hero-original.webp")
MOCK = os.path.join(ROOT, "assets-src", "consult-phone-screen.png")
OUT = os.path.join(ROOT, "public", "assets", "img", "consult-hero.webp")


def prepare_mock(path):
    """Скрін застосунку → чистий прямокутник самого екрана.

    Скрін може приходити з білими полями по краях і чорною обводкою з
    заокругленими кутами. Беремо тільки справжній вміст (не майже біле і не
    майже чорне), обрізаємо по ньому, а потім у кожному рядку й стовпці
    розтягуємо крайній піксель вмісту до краю — так зникають і поля, і кутики.
    Пропорції не підганяємо: скрін дозволено трохи розтягнути під екран.
    """
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    s = a.sum(2)
    content = (s > 60) & (s < 735)
    ys, xs = np.nonzero(content)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    crop = a[y0:y1 + 1, x0:x1 + 1].copy()
    keep = content[y0:y1 + 1, x0:x1 + 1]
    for i in range(crop.shape[0]):                  # поля зліва й справа
        seg = np.nonzero(keep[i])[0]
        if not len(seg):
            continue
        crop[i, :seg[0]] = crop[i, seg[0]]
        crop[i, seg[-1] + 1:] = crop[i, seg[-1]]
        keep[i] = True
    for j in range(crop.shape[1]):                  # рядки, де вмісту не було зовсім
        seg = np.nonzero(keep[:, j])[0]
        if not len(seg):
            continue
        crop[:seg[0], j] = crop[seg[0], j]
        crop[seg[-1] + 1:, j] = crop[seg[-1], j]
    return Image.fromarray(crop.astype(np.uint8), "RGB")


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

side = lambda p, q: float(np.hypot(*(p - q)))
aspect = ((side(tl, tr) + side(bl, br)) / 2) / ((side(tl, bl) + side(tr, br)) / 2)
mock = prepare_mock(MOCK)
mw, mh = mock.size
print("пропорції екрана:", round(aspect, 4), "макет:", mock.size)

# коефіцієнти PIL перетворюють координату виходу в координату входу, тому пари йдуть dst -> src
A, B = [], []
for (dx, dy), (sx, sy) in zip(quad, [(0, 0), (mw, 0), (mw, mh), (0, mh)]):
    A.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]); B.append(sx)
    A.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]); B.append(sy)
coeffs = np.linalg.solve(np.array(A, float), np.array(B, float))
warped = mock.transform(hero.size, Image.PERSPECTIVE, coeffs, Image.BICUBIC)

# Малюємо рівно по тому екрану, що видно на фото, а не по розрахованому
# чотирикутнику: чотирикутник потрібен тільки для перспективи, а межу дає сам
# кадр. Так рамка телефона лишається цілою, заокруглення кутів — справжні,
# а пальці, що лежать на екрані, самі себе виключають.
white = (r > 228) & (g > 228) & (b > 228)
# заливка могла б просочитись крізь світлу щілину в рамці — тримаємо її в межах граней
yy, xx = np.mgrid[0:H, 0:W]
white &= (xx > mL * yy + cL - 8) & (xx < mR * yy + cR + 8)
white &= (yy > mT * xx + cT - 8) & (yy < mB * xx + cB + 8)
screen = np.zeros_like(white)             # біле поле екрана, залите з середини
seed = deque([(500, 950)])                # точка всередині екрана
screen[500, 950] = True
while seed:
    y, x = seed.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and white[ny, nx] and not screen[ny, nx]:
            screen[ny, nx] = True
            seed.append((ny, nx))
x0, x1 = int(min(c[0] for c in quad)) - 2, int(max(c[0] for c in quad)) + 3
y0, y1 = int(min(c[1] for c in quad)) - 2, int(max(c[1] for c in quad)) + 3
box = np.zeros_like(screen)
box[y0:y1, x0:x1] = True
# Старі картка й напис — це дірки всередині білого поля. Заливаємо «не-екран»
# від рамки прямокутника: до чого вона не дістала, те й є дірки.
out_fill = np.zeros_like(screen)
stack = [(y, x) for y in (y0, y1 - 1) for x in range(x0, x1)]
stack += [(y, x) for x in (x0, x1 - 1) for y in range(y0, y1)]
stack = [p for p in stack if not screen[p]]
for p in stack:
    out_fill[p] = True
stack = deque(stack)
while stack:
    y, x = stack.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if y0 <= ny < y1 and x0 <= nx < x1 and not screen[ny, nx] and not out_fill[ny, nx]:
            out_fill[ny, nx] = True
            stack.append((ny, nx))
screen |= box & ~out_fill                 # дірки всередині екрана — теж екран

m = Image.fromarray((screen * 255).astype(np.uint8), "L")
# По краю екрана йде смуга напівтонів, яка в білу заливку не потрапила: якщо її
# не закрити, стара світла облямівка світиться зубцями поверх нового скріна.
# Тому маску розширюємо на піксель і згладжуємо сходинки розмиттям з порогом.
m = m.filter(ImageFilter.MaxFilter(3))
m = m.filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 255 if v > 110 else 0)
m = m.filter(ImageFilter.GaussianBlur(0.6))

out = hero.copy()
out.paste(warped, (0, 0), m)
out.save(OUT, "WEBP", quality=88, method=6)
print("готово:", OUT)
