# Перефарбовує червоне коло на фото героя /pre-reg-form-consult у салатовий
# (#B0E62A — акцент з infobiz-lm300). Червоний чохол телефона лишається як є.
# Запускати з кореня репозиторію ПІСЛЯ consult-phone-screen.py, бо той збирає
# кадр з червоного оригіналу:
#   python assets-src/consult-phone-screen.py
#   python assets-src/consult-circle-color.py
#
# Як відокремлюється коло від чохла: чисто-червоні пікселі заливаються від кількох
# точок усередині кола. Від кола чохол відділений темною лінією, і заливка в нього
# не проходить, крім вузьких смужок унизу зліва — їх зрізає «відкриття» маски
# (ерозія + розширення) біля телефона. Далі три шари:
#   1) саме коло: тон міняється на салатовий, світлотінь і яскравість зберігаються;
#   2) м'який зовнішній край кола на білому: те саме, щоб не лишилось рожевої облямівки;
#   3) край, де коло заходить під волосся, шкіру, одяг: піксель — суміш червоного
#      з тим, що попереду; оцінюємо частку червоного й міняємо тільки її.
#   4) чохол телефона — теж у салатовий, з його бліками й тінями.
# Читає consult-hero.webp (червоний, після consult-phone-screen.py), пише consult-hero-lime.webp.
import os
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "assets", "img", "consult-hero.webp")
# окреме ім'я, а не перезапис: браузери тримають картинки тиждень (vercel.json),
# і зі старим ім'ям відвідувачі довго бачили б червоне коло
IMG = os.path.join(ROOT, "public", "assets", "img", "consult-hero-lime.webp")

RED = np.array([220, 0, 34]) / 255          # колір кола на оригіналі
LIME = np.array([176, 230, 42]) / 255       # #B0E62A
# коло, підігнане по зовнішньому краю (центр і радіус у пікселях кадру 1254×1254)
CX, CY, R = 628.9, 637.9, 563.6
# екран телефона — ті самі кути, що рахує consult-phone-screen.py
QUAD = [(726.5, 107.8), (970.7, 36.3), (1102.8, 563.7), (858.9, 622.2)]
SEEDS = [(600, 150), (900, 1100), (100, 700), (1000, 900)]  # (y, x) усередині кола

im = Image.open(SRC).convert("RGB")
W, H = im.size
a = np.asarray(im).astype(float) / 255
r, g, b = a[..., 0], a[..., 1], a[..., 2]

mx, mn = a.max(2), a.min(2)
c = mx - mn
hue = np.zeros_like(mx)
nz = c > 1e-6
hr = nz & (mx == r); hg = nz & (mx == g) & ~hr; hb = nz & ~hr & ~hg
hue[hr] = ((g - b)[hr] / c[hr]) % 6
hue[hg] = (b - r)[hg] / c[hg] + 2
hue[hb] = (r - g)[hb] / c[hb] + 4
hue *= 60
S = np.where(mx > 0, c / np.maximum(mx, 1e-6), 0)
V = mx

L = lambda m: Image.fromarray((m * 255).astype(np.uint8))
B = lambda i: np.asarray(i) > 127

red = (r > 150 / 255) & (g < 40 / 255) & (b < 60 / 255)
if not red[tuple(zip(*SEEDS))].any():
    raise SystemExit("червоного кола не знайдено: спершу запусти consult-phone-screen.py")

lab = np.zeros(red.shape, bool)
q = deque(s for s in SEEDS if red[s])
for s in q:
    lab[s] = True
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and red[ny, nx] and not lab[ny, nx]:
            lab[ny, nx] = True
            q.append((ny, nx))

# зона біля телефона: тут лишаємо тільки товсті шматки кола, тонкі смужки — це чохол
m = Image.new("L", (W, H), 0)
dr = ImageDraw.Draw(m)
dr.polygon(QUAD, fill=255)
dr.line(QUAD + [QUAD[0]], fill=255, width=80, joint="curve")
near = np.asarray(m) > 0
opened = B(L(lab).filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9)))

yy, xx = np.mgrid[0:H, 0:W]
dist = np.hypot(xx - CX, yy - CY) - R
# + дрібні острівці кола між пасмами волосся й пальцями, до яких заливка не дійшла
core = (lab & ~(near & ~opened)) | (red & (dist < 2) & ~near)

redhue = np.minimum(np.abs(hue - 351), 360 - np.abs(hue - 351)) < 20
rim = B(L(core).filter(ImageFilter.MaxFilter(5))) & (dist > -6) & redhue & (S > 0.04)
sel = core | rim

# 1–2) міняємо тон, насиченість і яскравість масштабуємо від червоного до салатового
nS = np.clip(S * (1 - 42 / 230), 0, 1)
nV = np.clip(V * (230 / 255) / (220 / 255), 0, 1)
f = 77 / 60 - 1                              # тон 77° лежить у секторі 60–120°
out = a.copy()
out[sel, 0] = (nV * (1 - nS * f))[sel]
out[sel, 1] = nV[sel]
out[sel, 2] = (nV * (1 - nS))[sel]

# 3) змішані пікселі на межі з людиною
band = (B(L(core).filter(ImageFilter.MaxFilter(17))) | ((dist < 4) & (dist > -15))) & ~sel & ~near
t = np.clip(((r - g) - 65 / 255) / (155 / 255), 0, 1) * band
out = np.clip(out + t[..., None] * (LIME - RED), 0, 1)

# 4) чохол: червоні пікселі в зоні телефона, які не належать колу. Шкіра пальців
#    має тон 10–25° і сюди не потрапляє; світлі бліки чохла мають низьку насиченість,
#    тому поріг по ній м'який.
def ring(w):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).line(QUAD + [QUAD[0]], fill=255, width=2 * w, joint="curve")
    return np.asarray(m) > 0
# насичений червоний — у смузі ±24 px від краю екрана; бліді бліки — тільки ±9 px,
# бо далі вже лежать нігті, а вони такого ж блідо-рожевого кольору
case = ~sel & redhue & ((ring(24) & (S > 0.4)) | (ring(9) & (S > 0.15)))
out[case, 0] = (nV * (1 - nS * f))[case]
out[case, 1] = nV[case]
out[case, 2] = (nV * (1 - nS))[case]

Image.fromarray((out * 255).round().astype(np.uint8)).save(IMG, "WEBP", quality=88, method=6)
print("готово:", IMG, "| коло:", int(sel.sum()), "px, край:", int((t > 0).sum()), "px, чохол:", int(case.sum()), "px")
