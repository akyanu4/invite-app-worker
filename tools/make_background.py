"""
Generates a text-free animated background (1080x1920, 29.97 fps) for a template.

  python tools/make_background.py <style> <out.mp4> [frames]

Styles: emerald (gold mandala on green), confetti (birthday), moonlight (cradle / naming ceremony),
blush (baby shower). Each has a gradient base, a moving element layer and a border.
"""
import math, subprocess, sys
import numpy as np, cv2
sys.path.insert(0, __import__('os').path.dirname(__file__))
from wedding_styles import STYLES as WEDDING_STYLES, Style as WeddingStyle
from PIL import Image, ImageDraw

W, H = 1080, 1920
STYLE = sys.argv[1]
OUT = sys.argv[2]
FINAL, OUT = OUT, OUT[:-4] + '.part.mp4'  # renamed when finished, so a half-written file is never used
N = int(sys.argv[3]) if len(sys.argv) > 3 else 1110
rng = np.random.default_rng(11)
Y, X = np.mgrid[0:H, 0:W].astype(np.float32)

GOLD, GOLD_L = (212, 175, 95), (245, 222, 160)


def radial(c_in, c_out, cy=0.47, spread=(0.75, 0.62)):
    r = np.sqrt(((X - W / 2) / (W * spread[0])) ** 2 + ((Y - H * cy) / (H * spread[1])) ** 2)
    t = np.clip(r, 0, 1)[..., None]
    return np.array(c_in, np.float32) * (1 - t) + np.array(c_out, np.float32) * t


def vertical(c_top, c_bot):
    t = (Y / H)[..., None]
    return np.array(c_top, np.float32) * (1 - t) + np.array(c_bot, np.float32) * t


def layer(size, fn, scale=2):
    im = Image.new('RGBA', (size[0] * scale, size[1] * scale), (0, 0, 0, 0))
    fn(ImageDraw.Draw(im), scale)
    return np.asarray(im.resize(size, Image.LANCZOS), np.float32) / 255


def over(dst, lay, x0, y0, mul=1.0):
    h, w = lay.shape[:2]
    a = lay[..., 3:4] * mul
    dst[y0:y0 + h, x0:x0 + w] = dst[y0:y0 + h, x0:x0 + w] * (1 - a) + lay[..., :3] * 255 * a


def border(color=GOLD, accent=GOLD_L, inset=46, round_corners=False):
    def fn(d, s):
        R = lambda v: int(v * s)
        if round_corners:
            d.rounded_rectangle([R(inset), R(inset), R(W - inset), R(H - inset)], radius=R(60), outline=color + (230,), width=R(3))
            d.rounded_rectangle([R(inset + 16), R(inset + 16), R(W - inset - 16), R(H - inset - 16)], radius=R(48), outline=color + (150,), width=R(1))
        else:
            for ins, w_, a in ((inset, 3, 230), (inset + 18, 1, 170)):
                d.rectangle([R(ins), R(ins), R(W - ins), R(H - ins)], outline=color + (a,), width=R(w_))
            for cx, cy in ((inset, inset), (W - inset, inset), (inset, H - inset), (W - inset, H - inset)):
                d.polygon([(R(cx), R(cy - 14)), (R(cx + 14), R(cy)), (R(cx), R(cy + 14)), (R(cx - 14), R(cy))], fill=accent + (240,))
        cx = W / 2
        for cy in (inset, H - inset):
            d.polygon([(R(cx), R(cy - 18)), (R(cx + 26), R(cy)), (R(cx), R(cy + 18)), (R(cx - 26), R(cy))], fill=accent + (255,))
    return layer((W, H), fn)


# ------------------------------------------------------------------ style definitions
if STYLE == 'emerald':
    BASE = radial((22, 92, 70), (3, 28, 22))
    BORDER = border()
elif STYLE == 'confetti':
    BASE = radial((40, 52, 120), (12, 16, 48), cy=0.42)
    BORDER = border()
elif STYLE == 'moonlight':
    BASE = vertical((14, 18, 52), (86, 70, 140))
    BORDER = border(color=(225, 205, 150), accent=(250, 235, 190), round_corners=True)
elif STYLE == 'blush':
    BASE = vertical((252, 228, 226), (246, 206, 196))
    BORDER = border(color=(196, 150, 92), accent=(214, 172, 108), round_corners=True)
elif STYLE in WEDDING_STYLES:
    WS = WeddingStyle(STYLE, rng)
    WS.bake()
    BASE = WS.base
    BORDER = border(color=(196, 152, 72), accent=(214, 175, 100)) if STYLE == 'nikah' else border()
else:
    sys.exit(f'unknown style {STYLE}')

tex = (np.sin(X / 23.0) * np.sin(Y / 23.0) + np.sin((X + Y) / 31.0)) * (1.2 if STYLE in ('blush', 'nikah') else 0.6 if STYLE == 'haldi' else 2.2)
BASE = np.clip(BASE + tex[..., None], 0, 255)

# shared particle field (sparkles / stars / bubbles)
P = 150
px, py = rng.uniform(0, W, P), rng.uniform(0, H, P)
vy, vx = rng.uniform(-1.8, -0.5, P), rng.uniform(-0.3, 0.3, P)
size, phase, tw = rng.uniform(1.5, 6.0, P), rng.uniform(0, 2 * math.pi, P), rng.uniform(0.03, 0.09, P)

# confetti pieces
C = 170
cx_, cy_ = rng.uniform(0, W, C), rng.uniform(-H, H, C)
cvy, cvx = rng.uniform(2.2, 4.8, C), rng.uniform(-0.8, 0.8, C)
cang, cspin = rng.uniform(0, 360, C), rng.uniform(-6, 6, C)
cw, ch = rng.uniform(10, 22, C), rng.uniform(5, 10, C)
palette = [(255, 99, 132), (255, 205, 86), (75, 192, 192), (54, 162, 235), (153, 102, 255), (255, 159, 64), (240, 240, 240)]
ccol = [palette[i % len(palette)] for i in range(C)]

# baby shower bubbles / hearts
B = 26
bx, by = rng.uniform(80, W - 80, B), rng.uniform(0, H, B)
bvy, br = rng.uniform(-1.4, -0.6, B), rng.uniform(18, 46, B)
bheart = rng.uniform(0, 1, B) < 0.45

# moonlight clouds
MOON = layer((300, 300), lambda d, s: (
    d.ellipse([20 * s, 20 * s, 280 * s, 280 * s], fill=(255, 244, 214, 255)),
    d.ellipse([90 * s, -10 * s, 330 * s, 230 * s], fill=(0, 0, 0, 0)),
))
moon_mask = MOON.copy()


def mandala():
    MS = 1000

    def fn(d, s):
        c = MS * s / 2
        for rad, w_, a in ((480, 2, 120), (455, 1, 90), (360, 2, 110), (250, 1, 80), (150, 1, 70)):
            d.ellipse([c - rad * s, c - rad * s, c + rad * s, c + rad * s], outline=GOLD + (a,), width=int(w_ * s))
        for k in range(24):
            ang = 2 * math.pi * k / 24
            x, y = c + 470 * s * math.cos(ang), c + 470 * s * math.sin(ang)
            d.ellipse([x - 5 * s, y - 5 * s, x + 5 * s, y + 5 * s], fill=GOLD_L + (150,))
            for r0, r1, a in ((360, 455, 110), (250, 345, 80)):
                d.line([(c + r0 * s * math.cos(ang), c + r0 * s * math.sin(ang)), (c + r1 * s * math.cos(ang + 0.1), c + r1 * s * math.sin(ang + 0.1))], fill=GOLD + (a,), width=int(1.5 * s))
    return layer((MS, MS), fn), MS


if STYLE == 'emerald':
    MANDALA, MS = mandala()


def heart_poly(x, y, r):
    pts = []
    for t in np.linspace(0, 2 * math.pi, 40):
        hx = 16 * math.sin(t) ** 3
        hy = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((x + hx * r / 16, y + hy * r / 16))
    return pts


FRAME_TEST = __import__('os').environ.get('FRAME_TEST')
proc = None if FRAME_TEST else subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                         '-r', '30000/1001', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
                         '-pix_fmt', 'yuv420p', OUT], stdin=subprocess.PIPE)
for f in range(N):
    img = BASE.copy()
    # soft light sweep
    sweep_x = (f * 3.2) % (W * 2.4) - W * 0.7
    band = np.exp(-((X - sweep_x - (Y - H / 2) * 0.35) / 220) ** 2) * (10 if STYLE in ('blush', 'nikah', 'haldi') else 16)
    img += band[..., None] * np.array([1.0, 0.95, 0.8])

    if STYLE == 'emerald':
        M = cv2.getRotationMatrix2D((MS / 2, MS / 2), f * 0.06, 1.0)
        over(img, cv2.warpAffine(MANDALA, M, (MS, MS)), (W - MS) // 2, int(H * 0.47 - MS / 2), 0.55)

    if STYLE == 'moonlight':
        over(img, MOON, W - 330, 150 + int(6 * math.sin(f * 0.02)), 0.95)
        glow = np.exp(-(((X - (W - 180)) ** 2 + (Y - 300) ** 2) / (2 * 190 ** 2)))
        img += glow[..., None] * np.array([60, 55, 40])
        # rolling clouds at the bottom
        for k, (cy0, sp, a) in enumerate(((1680, 0.6, 0.55), (1760, 0.9, 0.7), (1840, 1.2, 0.85))):
            cl = np.zeros((H, W), np.float32)
            for j in range(7):
                xx = int((j * 220 + f * sp + k * 90) % (W + 400) - 200)
                cv2.circle(cl, (xx, cy0), 150 - k * 15, 1.0, -1, cv2.LINE_AA)
            cl = cv2.GaussianBlur(cl, (0, 0), 25) * a
            img = img * (1 - cl[..., None]) + np.array([235, 228, 250]) * cl[..., None]

    if STYLE in ('emerald', 'moonlight', 'confetti'):
        glow = np.zeros((H // 2, W // 2), np.float32)
        yy = (py + vy * f * (0.3 if STYLE == 'moonlight' else 1)) % H
        xx = (px + vx * f + 18 * np.sin(phase + f * 0.01)) % W
        bright = 0.55 + 0.45 * np.sin(phase + f * tw * (2 if STYLE == 'moonlight' else 1))
        for i in range(P):
            cv2.circle(glow, (int(xx[i] / 2), int(yy[i] / 2)), max(1, int(size[i] / 2)), float(bright[i]), -1, cv2.LINE_AA)
        glow = cv2.GaussianBlur(glow, (0, 0), 2.2) * 1.6 + glow * 0.8
        glow = cv2.resize(glow, (W, H))
        tint = np.array([255, 245, 210]) if STYLE == 'moonlight' else np.array([255, 215, 140])
        img += glow[..., None] * tint * (0.9 if STYLE != 'confetti' else 0.5)

    if STYLE == 'confetti':
        lay = np.zeros((H, W, 4), np.float32)
        for i in range(C):
            yy = (cy_[i] + cvy[i] * f) % (H + 80) - 40
            xx = (cx_[i] + cvx[i] * f + 25 * math.sin(phase[i % P] + f * 0.04)) % W
            ang = math.radians(cang[i] + cspin[i] * f)
            flip = abs(math.cos(f * 0.08 + i))  # tumbling
            w_, h_ = cw[i], ch[i] * (0.25 + 0.75 * flip)
            pts = cv2.boxPoints(((xx, yy), (w_, h_), math.degrees(ang))).astype(np.int32)
            col = ccol[i]
            cv2.fillConvexPoly(lay, pts, (col[0] / 255, col[1] / 255, col[2] / 255, 0.95), cv2.LINE_AA)
        over(img, lay, 0, 0)

    if STYLE == 'blush':
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        for i in range(B):
            yy = (by[i] + bvy[i] * f) % (H + 120) - 60
            xx = bx[i] + 20 * math.sin(f * 0.02 + i)
            r = br[i]
            if bheart[i]:
                d.polygon(heart_poly(xx, yy, r), fill=(232, 140, 160, 90))
            else:
                d.ellipse([xx - r, yy - r, xx + r, yy + r], fill=(255, 255, 255, 70), outline=(255, 255, 255, 150), width=2)
                d.ellipse([xx - r * 0.45, yy - r * 0.55, xx - r * 0.15, yy - r * 0.25], fill=(255, 255, 255, 150))
        over(img, np.asarray(lay, np.float32) / 255, 0, 0)

    if STYLE in WEDDING_STYLES:
        img = WS.draw(img, f)
    over(img, BORDER, 0, 0)
    k = min(1.0, f / 15.0, (N - 1 - f) / 20.0)
    img *= max(0.0, k)
    if FRAME_TEST:
        if f in [int(v) for v in FRAME_TEST.split(',')]:
            from PIL import Image as _I; _I.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(f'{OUT[:-9]}_f{f}.png')
        if f >= max(int(v) for v in FRAME_TEST.split(',')):
            break
        continue
    proc.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
    if f % 200 == 0:
        print(STYLE, 'frame', f, flush=True)
if FRAME_TEST:
    sys.exit()
proc.stdin.close()
proc.wait()
import os
os.replace(OUT, FINAL)
print('done', FINAL)
