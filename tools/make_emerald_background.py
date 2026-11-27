"""Generates templates/emerald_gold/background.mp4 - a text-free animated background."""
import math, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageDraw

W, H, FPS = 1080, 1920, 30000 / 1001
N = int(sys.argv[2]) if len(sys.argv) > 2 else 1320
OUT = sys.argv[1]
rng = np.random.default_rng(7)

GOLD = (212, 175, 95)
GOLD_L = (245, 222, 160)

# ---- static base: emerald radial gradient
Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
r = np.sqrt(((X - W / 2) / (W * 0.75)) ** 2 + ((Y - H * 0.47) / (H * 0.62)) ** 2)
t = np.clip(r, 0, 1)[..., None]
c_in, c_out = np.array([22, 92, 70], np.float32), np.array([3, 28, 22], np.float32)
BASE = c_in * (1 - t) + c_out * t
# fine damask-like texture
tex = (np.sin(X / 23.0) * np.sin(Y / 23.0) + np.sin((X + Y) / 31.0)) * 2.2
BASE = np.clip(BASE + tex[..., None], 0, 255)


def draw_layer(size, fn, scale=2):
    im = Image.new('RGBA', (size[0] * scale, size[1] * scale), (0, 0, 0, 0))
    fn(ImageDraw.Draw(im), scale)
    return np.asarray(im.resize(size, Image.LANCZOS), np.float32) / 255


# ---- border with corner flourishes (static)
def border(d, s):
    def R(v): return int(v * s)
    for inset, w, a in ((46, 3, 230), (64, 1, 170)):
        d.rectangle([R(inset), R(inset), R(W - inset), R(H - inset)], outline=GOLD + (a,), width=R(w))
    for cx, cy, sx, sy in ((46, 46, 1, 1), (W - 46, 46, -1, 1), (46, H - 46, 1, -1), (W - 46, H - 46, -1, -1)):
        for rad in (70, 95):
            box = [R(cx - rad), R(cy - rad), R(cx + rad), R(cy + rad)]
            start = {(1, 1): 0, (-1, 1): 90, (-1, -1): 180, (1, -1): 270}[(sx, sy)]
            d.arc(box, start, start + 90, fill=GOLD + (220,), width=R(2))
        x, y = cx + sx * 30, cy + sy * 30
        d.polygon([(R(x), R(y - 14)), (R(x + 14), R(y)), (R(x), R(y + 14)), (R(x - 14), R(y))], fill=GOLD_L + (240,))
    for cy, sgn in ((46, 1), (H - 46, -1)):
        cx = W / 2
        d.polygon([(R(cx), R(cy - 18)), (R(cx + 26), R(cy)), (R(cx), R(cy + 18)), (R(cx - 26), R(cy))], fill=GOLD_L + (255,))
        for k in (1, -1):
            d.arc([R(cx + k * 30 - 60), R(cy - 30 * sgn - 30), R(cx + k * 30 + 60), R(cy - 30 * sgn + 30)],
                  0 if sgn > 0 else 180, 180 if sgn > 0 else 360, fill=GOLD + (200,), width=R(2))


BORDER = draw_layer((W, H), border)


# ---- mandala (rotates slowly)
MS = 1000
def mandala(d, s):
    c = MS * s / 2
    def circ(rad, w, a):
        d.ellipse([c - rad * s, c - rad * s, c + rad * s, c + rad * s], outline=GOLD + (a,), width=int(w * s))
    for rad, w, a in ((480, 2, 120), (455, 1, 90), (360, 2, 110), (250, 1, 80), (150, 1, 70)):
        circ(rad, w, a)
    for k in range(24):
        ang = 2 * math.pi * k / 24
        for r0, r1, wid, a in ((360, 455, 26, 110), (250, 345, 18, 80)):
            p = []
            for tt in np.linspace(0, 1, 18):
                rr = r0 + (r1 - r0) * tt
                off = math.sin(math.pi * tt) * wid / rr
                p.append((c + rr * s * math.cos(ang + off), c + rr * s * math.sin(ang + off)))
            for tt in np.linspace(1, 0, 18):
                rr = r0 + (r1 - r0) * tt
                off = -math.sin(math.pi * tt) * wid / rr
                p.append((c + rr * s * math.cos(ang + off), c + rr * s * math.sin(ang + off)))
            d.line(p + [p[0]], fill=GOLD + (a,), width=int(1.5 * s))
        x, y = c + 470 * s * math.cos(ang), c + 470 * s * math.sin(ang)
        d.ellipse([x - 5 * s, y - 5 * s, x + 5 * s, y + 5 * s], fill=GOLD_L + (150,))


MANDALA = draw_layer((MS, MS), mandala)

# ---- particles
P = 140
px = rng.uniform(0, W, P); py = rng.uniform(0, H, P)
vy = rng.uniform(-1.8, -0.6, P); vx = rng.uniform(-0.3, 0.3, P)
size = rng.uniform(1.5, 6.0, P); phase = rng.uniform(0, 2 * math.pi, P); tw = rng.uniform(0.03, 0.09, P)


def over(dst, layer, x0, y0, alpha_mul=1.0):
    h, w = layer.shape[:2]
    a = layer[..., 3:4] * alpha_mul
    dst[y0:y0 + h, x0:x0 + w] = dst[y0:y0 + h, x0:x0 + w] * (1 - a) + layer[..., :3] * 255 * a


proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                         '-r', '30000/1001', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
                         '-pix_fmt', 'yuv420p', OUT], stdin=subprocess.PIPE)
for f in range(N):
    img = BASE.copy()
    # light sweep
    sweep_x = (f * 3.2) % (W * 2.4) - W * 0.7
    band = np.exp(-((X - sweep_x - (Y - H / 2) * 0.35) / 220) ** 2) * 18
    img += band[..., None] * np.array([0.9, 1.0, 0.7])
    # mandala
    ang = f * 0.06
    M = cv2.getRotationMatrix2D((MS / 2, MS / 2), ang, 1.0)
    rot = cv2.warpAffine(MANDALA, M, (MS, MS))
    over(img, rot, (W - MS) // 2, int(H * 0.47 - MS / 2), 0.55)
    # particles (additive glow)
    glow = np.zeros((H // 2, W // 2), np.float32)
    yy = (py + vy * f) % H; xx = (px + vx * f + 18 * np.sin(phase + f * 0.01)) % W
    bright = 0.55 + 0.45 * np.sin(phase + f * tw)
    for i in range(P):
        cv2.circle(glow, (int(xx[i] / 2), int(yy[i] / 2)), max(1, int(size[i] / 2)), float(bright[i]), -1, cv2.LINE_AA)
    glow = cv2.GaussianBlur(glow, (0, 0), 2.2) * 1.6 + glow * 0.8
    glow = cv2.resize(glow, (W, H))
    img += glow[..., None] * np.array([255, 215, 140]) * 0.85
    over(img, BORDER, 0, 0)
    # fade in from black / out to black
    k = min(1.0, f / 15.0, (N - 1 - f) / 20.0)
    img *= max(0.0, k)
    proc.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
    if f % 200 == 0:
        print('frame', f, flush=True)
proc.stdin.close(); proc.wait()
print('done')
