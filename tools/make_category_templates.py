"""Writes template.json for the birthday, cradle and baby shower designs (shared 4-scene layout).

Scenes (frames at 29.97 fps, background is 1110 frames):
  intro  0-240    top line, occasion, name, small line
  family 240-450  hosts / parents (and grandparents)
  event  450-750  one card per event (repeats)
  close  750-1110 closing line + RSVP
"""
import json, sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'worker/templates')
FONTS = {"script": "GreatVibes-Regular.ttf", "caps": "Cinzel-VF.ttf", "serif": "Playfair-VF.ttf"}


DY, SCALE = 110, 1.15  # layouts below are drawn for the upper middle; this centres and enlarges them


def slot(text, font, size, y, at, width=860, dur=24):
    return {"text": text, "font": font, "size": int(size * SCALE), "max_width": width, "x": 540, "y": int(540 + (y - 540) * SCALE) + DY,
            "in": at, "dur": dur}


def div(y, at):
    return {"type": "divider", "width": 320, "x": 540, "y": int(540 + (y - 540) * SCALE) + DY, "in": at, "dur": 20}


EVENT = [
    slot("{title}", "script", 120, 610, 18, 860, 26),
    slot("{date}", "caps", 76, 770, 32),
    slot("{time}", "caps", 56, 875, 42, 820),
    div(960, 50),
    slot("{venue}", "caps", 66, 1060, 56, 880),
    slot("{address1}", "caps", 48, 1160, 64, 860, 26),
    slot("{address2}", "caps", 48, 1240, 70, 860, 26),
]


def scenes(intro, family, close):
    return [
        {"id": "intro", "start_frame": 0, "end_frame": 240, "transition_in": "cut", "slots": intro},
        {"id": "family", "start_frame": 240, "end_frame": 450, "transition_in": "fade", "slots": family},
        {"id": "event", "repeat": "events", "start_frame": 450, "end_frame": 750, "transition_in": "fade",
         "transition_between": "fade", "slots": EVENT},
        {"id": "close", "start_frame": 750, "end_frame": 1110, "transition_in": "fade", "slots": close},
    ]


DESIGNS = {
    "birthday_confetti": dict(
        category="birthday", title="Confetti Night", order=10, tags=["Colourful", "Kids"],
        description="Navy sky with falling colourful confetti and a gold frame.",
        scenes=scenes(
            [slot("{intro_line}", "caps", 40, 640, 18, 780), div(700, 24),
             slot("{occasion}", "script", 120, 815, 34, 860, 26), slot("{name}", "script", 200, 990, 46, 860, 28),
             slot("{wish_line}", "caps", 34, 1150, 66, 780)],
            [slot("{hosts_label}", "caps", 44, 760, 14, 800), div(830, 22), slot("{hosts}", "script", 110, 960, 28, 900, 26)],
            [slot("{closing}", "script", 120, 820, 16, 880, 26), div(940, 30), slot("{rsvp}", "caps", 52, 1050, 40, 860)],
        )),
    "cradle_moonlight": dict(
        category="cradle", title="Moonlight Lullaby", order=10, tags=["Soft", "Night sky"],
        description="Crescent moon, twinkling stars and drifting clouds.",
        scenes=scenes(
            [slot("{intro_line}", "caps", 36, 640, 18, 800), div(700, 24),
             slot("{occasion}", "script", 120, 815, 34, 860, 26), slot("{baby_name}", "script", 170, 985, 46, 860, 28),
             slot("{baby_line}", "caps", 34, 1140, 66, 780)],
            [slot("{parents_label}", "caps", 42, 640, 14, 800), slot("{parents}", "script", 110, 770, 24, 900, 26),
             div(880, 40), slot("{grandparents_label}", "caps", 40, 980, 48, 800),
             slot("{grandparents}", "script", 96, 1100, 58, 900, 26)],
            [slot("{closing}", "script", 104, 820, 16, 880, 26), div(940, 30), slot("{rsvp}", "caps", 52, 1050, 40, 860)],
        )),
    "babyshower_blush": dict(
        category="baby_shower", title="Blush & Bubbles", order=10, tags=["Soft", "Pastel"],
        description="Blush pink with floating bubbles and little hearts.",
        scenes=scenes(
            [slot("{intro_line}", "caps", 40, 640, 18, 780), div(700, 24),
             slot("{occasion}", "script", 130, 820, 34, 860, 26), slot("{mom_name}", "script", 180, 990, 46, 860, 28),
             slot("{tagline}", "caps", 34, 1145, 66, 780)],
            [slot("{hosts_label}", "caps", 44, 760, 14, 800), div(830, 22), slot("{hosts}", "script", 100, 960, 28, 900, 26)],
            [slot("{closing}", "script", 104, 820, 16, 880, 26), div(940, 30), slot("{rsvp}", "caps", 52, 1050, 40, 860)],
        )),
}

for name, d in DESIGNS.items():
    tpl = {
        "name": name, "category": d["category"], "title": d["title"], "description": d["description"],
        "tags": d["tags"], "order": d["order"], "preview_scene": "intro", "preview_at": 0.8,
        "width": 1080, "height": 1920, "fps": "30000/1001", "background": "background.mp4",
        "music": "music.m4a", "music_align": "end", "fonts": FONTS, "text_fade_out_frames": 16,
        "scenes": d["scenes"], "defaults": {},
    }
    out = ROOT / name
    out.mkdir(parents=True, exist_ok=True)
    (out / "template.json").write_text(json.dumps(tpl, indent=2, ensure_ascii=False), encoding="utf-8")
    print("wrote", out / "template.json")
