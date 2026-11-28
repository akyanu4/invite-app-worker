"""Marriage-event backgrounds for make_background.py: nikah, mehndi, valima, baraat.

Each style keeps the middle band (y 520-1340), where the invitation text sits, calm:
moving elements live at the top, the bottom and the sides.
"""
import math
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter

W, H = 1080, 1920
STYLES = ('nikah', 'mehndi', 'valima', 'baraat')


def rgba_layer(size, fn, scale=2):
    im = Image.new('RGBA', (size[0] * scale, size[1] * scale), (0, 0, 0, 0))
    fn(ImageDraw.Draw(im), scale)
    return im.resize(size, Image.LANCZOS)


def to_f(im):
    return np.asarray(im, np.float32) / 255


def paste(img, lay, x0, y0, mul=1.0):
    """Alpha-composites float RGBA `lay` onto float RGB `img` (0-255) at x0, y0, clipped to the frame."""
    h, w = lay.shape[:2]
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if xa >= xb or ya >= yb:
        return
    sub = lay[ya - y0:yb - y0, xa - x0:xb - x0]
    a = sub[..., 3:4] * mul
    img[ya:yb, xa:xb] = img[ya:yb, xa:xb] * (1 - a) + sub[..., :3] * 255 * a


def glow_dots(points, sigma=3.0, half=True):
    """Soft glowing dots: points = [(x, y, radius, brightness)]. Returns HxW float map."""
    s = 2 if half else 1
    g = np.zeros((H // s, W // s), np.float32)
    for x, y, r, b in points:
        cv2.circle(g, (int(x / s), int(y / s)), max(1, int(r / s)), float(b), -1, cv2.LINE_AA)
    g = cv2.GaussianBlur(g, (0, 0), sigma) * 1.8 + g * 0.7
    return cv2.resize(g, (W, H)) if half else g


def rotated(im, deg, pivot):
    """Rotates a PIL RGBA image around pivot (px in the image); returns image and pivot's new position."""
    big = Image.new('RGBA', (im.width * 2, im.height * 2), (0, 0, 0, 0))
    ox, oy = im.width - pivot[0], im.height - pivot[1]
    big.paste(im, (ox, oy))
    big = big.rotate(deg, resample=Image.BICUBIC, center=(im.width, im.height))
    return big, (im.width, im.height)


class Style:
    def __init__(self, name, rng):
        self.name, self.rng = name, rng
        getattr(self, 'setup_' + name)()

    # ------------------------------------------------------------------ NIKAH: pearl & gold
    def setup_nikah(self):
        Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
        t = (Y / H)[..., None]
        base = np.array([248, 241, 226], np.float32) * (1 - t) + np.array([228, 210, 176], np.float32) * t
        r = np.sqrt(((X - W / 2) / (W * 0.7)) ** 2 + ((Y - H * 0.48) / (H * 0.5)) ** 2)
        base -= (np.clip(r, 0, 1) ** 2)[..., None] * np.array([18, 22, 30])
        self.base = base
        self.gold, self.gold_d = (196, 152, 72), (150, 108, 40)
        self.text_light = True

        def arch(d, s):
            R = lambda v: int(v * s)
            g = self.gold + (215,)
            for inset, wdt in ((0, 4), (22, 2)):
                x0, x1, top, low = 118 + inset, 962 - inset, 200 + inset, 1820
                apex = (540, top)
                spring = 560 + inset * 0.3
                # pointed arch made of two circle arcs
                pts_l, pts_r = [], []
                for k in range(41):
                    u = k / 40
                    pts_l.append((x0 + (apex[0] - x0) * math.sin(u * math.pi / 2) ** 1.4, spring - (spring - apex[1]) * math.sin(u * math.pi / 2)))
                pts_r = [(W - x, y) for x, y in pts_l]
                d.line([(R(x), R(y)) for x, y in [(x0, low)] + pts_l], fill=g, width=R(wdt))
                d.line([(R(x), R(y)) for x, y in [(x1, low)] + pts_r], fill=g, width=R(wdt))
            # jali dots along the inner arch
            for k in range(1, 40, 2):
                u = k / 40
                x = 140 + (540 - 140) * math.sin(u * math.pi / 2) ** 1.4
                y = 566 - (566 - 222) * math.sin(u * math.pi / 2)
                for xx in (x, W - x):
                    d.ellipse([R(xx - 3), R(y - 3), R(xx + 3), R(y + 3)], fill=self.gold + (170,))
            # dome skyline at the bottom
            sky = self.gold_d + (70,)
            for cx, rw, hh in ((540, 150, 170), (330, 90, 110), (750, 90, 110), (200, 55, 70), (880, 55, 70)):
                d.ellipse([R(cx - rw), R(1770 - hh * 1.6), R(cx + rw), R(1770 + hh * 0.4)], fill=sky)
                d.polygon([(R(cx - 6), R(1770 - hh * 1.6)), (R(cx), R(1770 - hh * 1.6 - 50)), (R(cx + 6), R(1770 - hh * 1.6))], fill=sky)
            for mx in (110, 970):
                d.rectangle([R(mx - 14), R(1460), R(mx + 14), R(1800)], fill=sky)
                d.ellipse([R(mx - 20), R(1430), R(mx + 20), R(1475)], fill=sky)
            d.rectangle([R(60), R(1770), R(W - 60), R(1860)], fill=sky)
            # crescent and star above the apex
            d.ellipse([R(500), R(300), R(580), R(380)], fill=self.gold + (235,))
            d.ellipse([R(522), R(290), R(598), R(366)], fill=(0, 0, 0, 0))
            st = [(586 + 16 * math.cos(math.radians(a)) * (1 if i % 2 == 0 else 0.45),
                   330 + 16 * math.sin(math.radians(a)) * (1 if i % 2 == 0 else 0.45)) for i, a in enumerate(range(-90, 270, 36))]
            d.polygon([(R(x), R(y)) for x, y in st], fill=self.gold + (235,))

        self.baked = [to_f(rgba_layer((W, H), arch))]
        # crescent hole: rgba_layer draws (0,0,0,0) over the moon; fix by drawing moon separately is overkill,
        # the transparent overdraw leaves the crescent shape.

        def lantern(d, s):
            R = lambda v: int(v * s)
            g, gd = self.gold + (255,), self.gold_d + (255,)
            d.line([(R(40), R(0)), (R(40), R(30))], fill=gd, width=R(2))
            d.polygon([(R(26), R(30)), (R(54), R(30)), (R(62), R(44)), (R(18), R(44))], fill=g)
            d.polygon([(R(18), R(44)), (R(62), R(44)), (R(70), R(100)), (R(56), R(132)), (R(24), R(132)), (R(10), R(100))],
                      fill=(255, 214, 140, 235), outline=g)
            for xx in (30, 40, 50):
                d.line([(R(xx), R(46)), (R(xx + (xx - 40) * 0.6), R(130))], fill=gd, width=R(2))
            d.polygon([(R(24), R(132)), (R(56), R(132)), (R(46), R(148)), (R(34), R(148))], fill=g)
            d.line([(R(40), R(148)), (R(40), R(166))], fill=gd, width=R(2))
            d.ellipse([R(35), R(164), R(45), R(174)], fill=g)

        self.lantern = rgba_layer((80, 176), lantern)
        self.lanterns = [(250, 228, 60, 0.0), (390, 240, 80, 1.7), (690, 240, 80, 3.1), (830, 228, 60, 4.4)]  # bottoms stay above y 500  # x, top, string, phase
        P = 90
        self.px, self.py = self.rng.uniform(140, W - 140, P), self.rng.uniform(0, H, P)
        self.pv, self.pph = self.rng.uniform(0.4, 1.1, P), self.rng.uniform(0, 6.28, P)

    def draw_nikah(self, img, f):
        glow = np.zeros((H // 4, W // 4), np.float32)
        placed = []
        for x, top, string, ph in self.lanterns:
            ang = 5.0 * math.sin(f * 0.035 + ph)
            lay = Image.new('RGBA', (80, string + 176), (0, 0, 0, 0))
            dd = ImageDraw.Draw(lay)
            dd.line([(40, 0), (40, string)], fill=self.gold_d + (220,), width=2)
            lay.alpha_composite(self.lantern, (0, string))
            rot, piv = rotated(lay, ang, (40, 0))
            # warm glow around the lantern body
            cx = x + math.sin(math.radians(-ang)) * (string + 90)
            cy = top + math.cos(math.radians(-ang)) * (string + 90)
            cv2.circle(glow, (int(cx / 4), int(cy / 4)), 14, 0.85 + 0.15 * math.sin(f * 0.2 + ph), -1)
            placed.append((rot, int(x - piv[0]), int(top - piv[1])))
        glow = cv2.resize(cv2.GaussianBlur(glow, (0, 0), 10), (W, H))[..., None]
        img += glow * np.array([70, 50, 10])
        for rot, px_, py_ in placed:
            lay = to_f(rot.crop(rot.getbbox())) if rot.getbbox() else None
            if lay is not None:
                bx, by = rot.getbbox()[:2]
                paste(img, lay, px_ + bx, py_ + by)
        yy = (self.py - self.pv * f) % H
        xx = self.px + 14 * np.sin(self.pph + f * 0.015)
        b = 0.5 + 0.5 * np.sin(self.pph + f * 0.07)
        g = glow_dots([(xx[i], yy[i], 3, b[i]) for i in range(len(xx))], 2.0)
        a = np.clip(g * 0.7, 0, 1)[..., None]
        img[:] = img * (1 - a) + np.array([214, 168, 80]) * a
        return img

    # ------------------------------------------------------------------ MEHNDI: green & marigold
    def setup_mehndi(self):
        Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
        r = np.clip(np.sqrt(((X - W / 2) / (W * 0.75)) ** 2 + ((Y - H * 0.48) / (H * 0.6)) ** 2), 0, 1)[..., None]
        self.base = np.array([34, 104, 58], np.float32) * (1 - r) + np.array([6, 40, 22], np.float32) * r
        self.text_light = False
        gold = (226, 186, 96)

        def henna(d, s):  # faint henna mandala behind the text + paisleys in the corners
            R = lambda v: int(v * s)
            c = (540, 930)
            for rad, a in ((430, 60), (360, 50), (250, 45)):
                d.ellipse([R(c[0] - rad), R(c[1] - rad), R(c[0] + rad), R(c[1] + rad)], outline=gold + (a,), width=R(2))
            for k in range(32):
                ang = 2 * math.pi * k / 32
                x0, y0 = c[0] + 360 * math.cos(ang), c[1] + 360 * math.sin(ang)
                x1, y1 = c[0] + 430 * math.cos(ang + 0.06), c[1] + 430 * math.sin(ang + 0.06)
                d.line([(R(x0), R(y0)), (R(x1), R(y1))], fill=gold + (55,), width=R(2))
                px_, py_ = c[0] + 395 * math.cos(ang + 0.1), c[1] + 395 * math.sin(ang + 0.1)
                d.ellipse([R(px_ - 5), R(py_ - 5), R(px_ + 5), R(py_ + 5)], outline=gold + (60,), width=R(1))
            for (cx, cy, flip) in ((150, 1650, 1), (930, 1650, -1)):
                pts = []
                for k in range(60):
                    t = k / 59 * 2 * math.pi
                    rr = 70 * (1 - 0.55 * math.cos(t)) * (0.6 + 0.4 * math.sin(t / 2))
                    pts.append((cx + flip * rr * math.cos(t) * 0.8, cy + rr * math.sin(t)))
                d.line([(R(x), R(y)) for x, y in pts + pts[:1]], fill=gold + (120,), width=R(3))
                d.ellipse([R(cx - 14), R(cy - 4), R(cx + 14), R(cy + 24)], outline=gold + (120,), width=R(2))

        self.baked = [to_f(rgba_layer((W, H), henna))]
        # garlands hanging down the sides: (x, length, phase)
        self.strands = [(78, 430, 0.0), (128, 330, 1.3), (178, 240, 2.2), (W - 78, 430, 0.7), (W - 128, 330, 2.0), (W - 178, 240, 3.0)]
        self.flower = {}
        for name, col in (('o', (243, 128, 22)), ('y', (255, 196, 36))):
            def fl(d, s, col=col):
                R = lambda v: int(v * s)
                for k in range(10):
                    a = 2 * math.pi * k / 10
                    x, y = 17 + 9 * math.cos(a), 17 + 9 * math.sin(a)
                    d.ellipse([R(x - 8), R(y - 8), R(x + 8), R(y + 8)], fill=col + (255,))
                d.ellipse([R(10), R(10), R(24), R(24)], fill=tuple(int(c * 0.8) for c in col) + (255,))
            self.flower[name] = to_f(rgba_layer((34, 34), fl))
        P = 46
        self.px, self.py = self.rng.uniform(0, W, P), self.rng.uniform(0, H, P)
        self.pv, self.pph = self.rng.uniform(1.4, 3.0, P), self.rng.uniform(0, 6.28, P)
        self.pc = [(243, 128, 22) if i % 2 else (255, 196, 36) for i in range(P)]

    def draw_mehndi(self, img, f):
        # top swag (toran): scallops of marigolds across the top
        for k in range(13):
            x = 60 + k * 80
            sag = 34 * math.sin(math.pi * ((x - 60) % 160) / 160)
            y = 70 + sag + 3 * math.sin(f * 0.05 + k)
            paste(img, self.flower['oy'[k % 2]], int(x - 17), int(y - 17))
        for x0, length, ph in self.strands:
            n = int(length / 27)
            for i in range(n):
                d = i / n
                x = x0 + 16 * math.sin(f * 0.04 + ph) * d ** 1.3
                y = 90 + i * 27
                paste(img, self.flower['oy'[i % 2]], int(x - 17), int(y - 17))
            # tassel bead at the end
            cv2.circle(img, (int(x0 + 16 * math.sin(f * 0.04 + ph)), int(90 + n * 27 + 10)), 7, (220, 40, 60), -1, cv2.LINE_AA)
        # bottom garland swag
        for k in range(13):
            x = 60 + k * 80
            sag = 40 * math.sin(math.pi * ((x - 60) % 240) / 240)
            y = 1760 - sag + 3 * math.sin(f * 0.05 + k)
            paste(img, self.flower['yo'[k % 2]], int(x - 17), int(y - 17))
        # falling petals (kept to the edges and the free bands)
        for i in range(len(self.px)):
            y = (self.py[i] + self.pv[i] * f) % (H + 40) - 20
            x = (self.px[i] + 30 * math.sin(self.pph[i] + f * 0.03)) % W
            if 560 < y < 1300 and 260 < x < W - 260:
                continue
            ang = (self.pph[i] * 57 + f * 3) % 180
            cv2.ellipse(img, (int(x), int(y)), (8, 4), ang, 0, 360, self.pc[i], -1, cv2.LINE_AA)
        return img

    # ------------------------------------------------------------------ VALIMA: royal maroon, chandelier
    def setup_valima(self):
        Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
        r = np.clip(np.sqrt(((X - W / 2) / (W * 0.75)) ** 2 + ((Y - H * 0.5) / (H * 0.62)) ** 2), 0, 1)[..., None]
        self.base = np.array([128, 26, 44], np.float32) * (1 - r) + np.array([42, 4, 14], np.float32) * r
        self.text_light = False
        gold = (230, 190, 104)
        self.crystals = []

        def chandelier(d, s):
            R = lambda v: int(v * s)
            g = gold + (255,)
            d.line([(R(540), R(0)), (R(540), R(110))], fill=g, width=R(3))
            d.ellipse([R(526), R(100), R(554), R(128)], fill=g)
            for y, wdt, n in ((190, 300, 9), (270, 400, 11), (340, 220, 7)):
                d.arc([R(540 - wdt / 2), R(y - 40), R(540 + wdt / 2), R(y + 40)], 0, 180, fill=g, width=R(4))
                for k in range(n):
                    a = math.pi * k / (n - 1)
                    x = 540 + wdt / 2 * math.cos(a)
                    yy = y + 40 * math.sin(a)
                    d.line([(R(x), R(yy)), (R(x), R(yy + 26))], fill=gold + (200,), width=R(1))
                    self.crystals.append((x, yy + 32))
                for side in (-1, 1):  # candles on the ends
                    x = 540 + side * wdt / 2
                    d.rectangle([R(x - 5), R(y - 52), R(x + 5), R(y - 8)], fill=(250, 238, 214, 255))
                    self.crystals.append((x, y - 62, 'flame'))
            d.line([(R(540), R(128)), (R(540), R(380))], fill=g, width=R(5))
            for y in (150, 230, 310, 380):
                d.ellipse([R(530), R(y - 10), R(550), R(y + 10)], fill=g)
            for x in (180, 900):  # wall sconces' drapes
                pass

        self.static = to_f(rgba_layer((W, H), chandelier))

        def drape(d, s):  # gold-edged curtain swags at the top corners
            R = lambda v: int(v * s)
            for flip in (0, 1):
                pts = [(0, 0), (330, 0)]
                for k in range(31):
                    t = k / 30
                    pts.append((330 - 330 * t, 260 * math.sin(t * math.pi / 2) * (1 - t * 0.25) + 0 * t))
                if flip:
                    pts = [(W - x, y) for x, y in pts]
                d.polygon([(R(x), R(y)) for x, y in pts], fill=(92, 10, 26, 235))
                d.line([(R(x), R(y)) for x, y in pts[2:]], fill=gold + (255,), width=R(4))
        self.baked = [to_f(rgba_layer((W, H), drape)), self.static]
        P = 44
        self.px, self.py = self.rng.uniform(0, W, P), self.rng.uniform(-H, H, P)
        self.pv, self.pph = self.rng.uniform(1.2, 2.6, P), self.rng.uniform(0, 6.28, P)
        self.pc = [(200, 24, 52), (232, 76, 104), (176, 16, 40)]
        Q = 120
        self.sx, self.sy = self.rng.uniform(0, W, Q), self.rng.uniform(0, H, Q)
        self.sph = self.rng.uniform(0, 6.28, Q)

    def draw_valima(self, img, f):
        b = 0.5 + 0.5 * np.sin(self.sph + f * 0.05)
        g = glow_dots([(self.sx[i], (self.sy[i] - 0.4 * f) % H, 2.5, b[i]) for i in range(len(self.sx))], 2.0)
        img += g[..., None] * np.array([255, 210, 140]) * 0.45
        sway = 0.0
        pts = []
        for k, c in enumerate(self.crystals):
            if len(c) == 3:
                pts.append((c[0] + sway, c[1] + 2 * math.sin(f * 0.3 + k), 7, 1.0))
            else:
                pts.append((c[0] + sway, c[1], 4, 0.4 + 0.6 * max(0, math.sin(f * 0.11 + k * 1.7))))
        g = glow_dots(pts, 2.5, half=False)
        img += g[..., None] * np.array([255, 226, 160]) * 0.9
        for i in range(len(self.px)):
            y = (self.py[i] + self.pv[i] * f) % (H + 60) - 30
            x = (self.px[i] + 40 * math.sin(self.pph[i] + f * 0.025)) % W
            ang = (self.pph[i] * 57 + f * 2.5) % 180
            col = self.pc[i % 3]
            cv2.ellipse(img, (int(x), int(y)), (13, 8), ang, 0, 360, col, -1, cv2.LINE_AA)
            cv2.ellipse(img, (int(x), int(y)), (13, 8), ang, 200, 340, tuple(min(255, c + 50) for c in col), 2, cv2.LINE_AA)
        return img

    # ------------------------------------------------------------------ BARAAT: red, string lights, fireworks
    def setup_baraat(self):
        Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
        r = np.clip(np.sqrt(((X - W / 2) / (W * 0.75)) ** 2 + ((Y - H * 0.5) / (H * 0.62)) ** 2), 0, 1)[..., None]
        self.base = np.array([170, 22, 34], np.float32) * (1 - r) + np.array([58, 2, 10], np.float32) * r
        self.text_light = False
        self.bulbs = []
        cols = [(255, 214, 110), (255, 150, 60), (255, 236, 200), (255, 120, 150)]
        for y0, sag, x0, x1, step in ((80, 90, 60, W - 60, 44), (190, 70, 60, W - 60, 48), (1740, -60, 60, W - 60, 48), (1830, -40, 60, W - 60, 44)):
            n = int((x1 - x0) / step)
            for seg in range(3):  # three scallops per string
                for k in range(n // 3 + 1):
                    t = k / (n // 3)
                    sx0 = x0 + (x1 - x0) * seg / 3
                    x = sx0 + (x1 - x0) / 3 * t
                    y = y0 + sag * math.sin(math.pi * t)
                    self.bulbs.append((x, y, cols[len(self.bulbs) % 4], self.rng.uniform(0, 6.28)))
        self.wires = []
        for y0, sag in ((80, 90), (190, 70), (1740, -60), (1830, -40)):
            for seg in range(3):
                xs = np.linspace(60 + (W - 120) * seg / 3, 60 + (W - 120) * (seg + 1) / 3, 30)
                ys = y0 + sag * np.sin(np.pi * (xs - xs[0]) / (xs[-1] - xs[0]))
                self.wires.append(np.stack([xs, ys], 1).astype(np.int32))
        self.bursts = []  # (start_frame, x, y, colour)
        f0 = 10
        while f0 < 1400:
            region = self.rng.integers(0, 2)
            y = self.rng.uniform(320, 470) if region == 0 else self.rng.uniform(1420, 1600)
            self.bursts.append((f0, self.rng.uniform(200, W - 200), y, cols[int(self.rng.integers(0, 4))]))
            f0 += int(self.rng.integers(28, 60))
        self.dirs = self.rng.uniform(0, 2 * math.pi, 70)
        self.speeds = self.rng.uniform(0.6, 1.0, 70)

    def draw_baraat(self, img, f):
        for w in self.wires:
            cv2.polylines(img, [w], False, (70, 30, 20), 2, cv2.LINE_AA)
        pts = [(x, y, 10, 0.55 + 0.45 * math.sin(f * 0.12 + ph)) for x, y, c, ph in self.bulbs]
        g = glow_dots(pts, 3.0)
        img += g[..., None] * np.array([255, 200, 120]) * 0.8
        for x, y, c, ph in self.bulbs:
            cv2.circle(img, (int(x), int(y)), 8, c, -1, cv2.LINE_AA)
        for start, bx, by, col in self.bursts:
            age = f - start
            fw = []
            if 0 <= age < 60:
                rad = 230 * (1 - math.exp(-age / 11))
                fade = max(0.0, 1 - age / 60) ** 1.3
                for k in range(len(self.dirs)):
                    for tail in (0, 0.12, 0.24):  # short streak behind each spark
                        r = rad * self.speeds[k] * (1 - tail)
                        x = bx + math.cos(self.dirs[k]) * r
                        y = by + math.sin(self.dirs[k]) * r + 0.035 * age ** 2
                        fw.append((x, y, 5 - tail * 8, fade * (1 - tail * 2.5)))
                if age < 6:
                    fw.append((bx, by, 40 - age * 5, 1.0))
            elif -14 <= age < 0:  # rising trail
                fw.append((bx, by + (-age) * 20, 4, 0.9))
            if fw:
                g = glow_dots(fw, 2.4)
                img += g[..., None] * np.array(col, np.float32) * 1.5
        return img

    def bake(self):
        """Draws the parts that never move into the base once, instead of on every frame."""
        for layer in getattr(self, 'baked', []):
            paste(self.base, layer, 0, 0)

    def draw(self, img, f):
        return getattr(self, 'draw_' + self.name)(img, f)
