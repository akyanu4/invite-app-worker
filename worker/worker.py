#!/usr/bin/env python3
"""
Invitation video worker.

Takes a job (JSON) describing the names/events - or a photo of a printed card -
renders an animated invitation video from a template, and returns an MP4.

Modes
  python worker.py run jobs/sample_job.json           # render one local job file
  python worker.py watch-folder jobs/inbox            # render every *.json dropped in a folder
  python worker.py watch-cloudinary                   # poll Cloudinary for new jobs (see README)
  python worker.py publish-templates                  # update the list of designs the app shows

Requires: Python 3.10+, ffmpeg on PATH, packages in requirements.txt.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, time, traceback, urllib.request
from collections import defaultdict
from fractions import Fraction
from pathlib import Path

import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / "fonts"
TEMPLATES = ROOT / "templates"
OUTPUT = ROOT / "output"

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass


# Let .env point at FFmpeg when it isn't on PATH (e.g. when started by Task Scheduler)
if os.environ.get("FFMPEG_DIR"):
    os.environ["PATH"] = os.environ["FFMPEG_DIR"] + os.pathsep + os.environ.get("PATH", "")


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# --------------------------------------------------------------------------- gold text
def _font(path, size):
    f = ImageFont.truetype(str(path), size)
    try:
        f.set_variation_by_name("Bold")  # Cinzel / Playfair are variable fonts
    except Exception:
        pass
    return f


def _stylize(A, ext=3):
    """A: alpha 0..1 (h, w). Returns RGBA float32 with gold gradient, bevel, extrusion, shadow."""
    h, w = A.shape
    ys = np.nonzero(A.max(1) > 0.1)[0]
    y0, y1 = (ys.min(), ys.max()) if len(ys) else (0, h)
    t = np.clip((np.arange(h) - y0) / max(1, y1 - y0), 0, 1)[:, None, None]
    c1, c2, c3 = np.array([252, 232, 165]), np.array([196, 150, 62]), np.array([238, 205, 122])
    grad = np.where(t < 0.5, c1 + (c2 - c1) * (t / 0.5), c2 + (c3 - c2) * ((t - 0.5) / 0.5))
    grad = np.broadcast_to(grad, (h, w, 3)).astype(np.float32)
    Ab = cv2.GaussianBlur(A, (0, 0), 1.6)
    gx = cv2.Sobel(Ab, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(Ab, cv2.CV_32F, 0, 1, ksize=3)
    light = np.clip((gx * 0.6 + gy * 0.8) * 1.6, -1, 1)
    face = np.clip(grad + light[..., None] * 70, 0, 255)
    out = np.zeros((h, w, 4), np.float32)
    out[..., :3] = (95, 85, 75)
    out[..., 3] = cv2.GaussianBlur(np.roll(np.roll(A, 7, 0), 8, 1), (0, 0), 5) * 0.30

    def over(rgb, a):
        a = a[..., None]
        oa = out[..., 3:4]
        na = a + oa * (1 - a)
        out[..., :3] = (rgb * a + out[..., :3] * oa * (1 - a)) / np.maximum(na, 1e-6)
        out[..., 3:4] = na

    dark = np.broadcast_to(np.array([120, 82, 30], np.float32), (h, w, 3))
    for i in range(ext, 0, -1):
        over(dark, np.roll(np.roll(A, i, 0), i, 1))
    over(face, A)
    return out


def text_png(text, font_path, size, max_w, path):
    while True:
        f = _font(font_path, size)
        bb = f.getbbox(text)
        if not max_w or bb[2] - bb[0] <= max_w or size <= 12:
            break
        size -= 2
    pad = 40
    im = Image.new("L", (bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad), 0)
    ImageDraw.Draw(im).text((pad - bb[0], pad - bb[1]), text, font=f, fill=255)
    return _save_rgba(_stylize(np.asarray(im, np.float32) / 255), path)


def divider_png(width, path):
    h = 40
    im = Image.new("L", (width + 40, h), 0)
    d = ImageDraw.Draw(im)
    cy, x0, x1 = h // 2, 20, width + 20
    d.line([(x0 + 14, cy), (x1 - 14, cy)], fill=255, width=4)
    for x, s in ((x0, 1), (x1, -1)):
        d.polygon([(x, cy), (x + 16 * s, cy - 7), (x + 30 * s, cy), (x + 16 * s, cy + 7)], fill=255)
    m = (x0 + x1) // 2
    d.polygon([(m - 12, cy), (m, cy - 9), (m + 12, cy), (m, cy + 9)], fill=255)
    return _save_rgba(_stylize(np.asarray(im, np.float32) / 255, 2), path)


def _save_rgba(rgba, path):
    img = np.clip(rgba, 0, 255)
    img[..., 3] = np.clip(rgba[..., 3] * 255, 0, 255)
    Image.fromarray(img.astype(np.uint8), "RGBA").save(path)
    return img.shape[1], img.shape[0]


# --------------------------------------------------------------------------- reading a card
def load_categories():
    path = ROOT / "categories.json"
    if not path.exists():
        return {}
    return {c["id"]: c for c in json.loads(path.read_text(encoding="utf-8"))["categories"]}


def card_prompt(cat):
    """Builds the card-reading instructions from the occasion's own form fields."""
    lines = []
    for sec in cat.get("sections", []):
        for f in sec["fields"]:
            how = "in CAPITALS" if f.get("caps") else "in normal case"
            lines.append(f'    "{f["key"]}": "{f["label"]} ({how}), e.g. {f.get("hint", "")}"')
    ev = ", ".join(f'"{f["key"]}": "{f["label"]}{" in CAPITALS" if f.get("caps") else ""}"'
                   for f in cat.get("events", {}).get("fields", []))
    return (f"You are reading a photo of {cat.get('card_hint', 'an invitation card')} (English, may include Urdu/Hindi).\n"
            "Return ONLY a JSON object, no other text, with this shape:\n"
            "{\n  \"fields\": {\n" + ",\n".join(lines) + "\n  },\n"
            "  \"events\": [ {" + ev + "} ]\n}\n"
            "List every event printed on the card, in date order. Keep each line short (under ~35 characters). "
            "Use \"\" for anything not on the card. If a name isn't printed (e.g. the bride's), use the wording the card uses.")


AI_MODELS = {
    "accurate": lambda: os.environ.get("INVITE_AI_MODEL", "claude-sonnet-5-5"),
    "approximate": lambda: os.environ.get("INVITE_AI_MODEL_FAST", "claude-haiku-5-5"),
}


def read_card(image_url, category="marriage", quality="accurate"):
    import anthropic
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise ValueError("Reading card photos needs a Claude API key. Add ANTHROPIC_API_KEY=... to the "
                         "worker's .env (from console.anthropic.com), restart the worker, or type the details instead.")
    cats = load_categories()
    cat = cats.get(category) or cats.get("marriage") or {}
    model = AI_MODELS.get(quality, AI_MODELS["accurate"])()
    client = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY
    log(f"reading card ({quality}) with", model)
    msg = client.messages.create(
        model=model,
        max_tokens=2000,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "url", "url": image_url}},
            {"type": "text", "text": card_prompt(cat)},
        ]}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("Could not read the card: " + text[:300])
    return json.loads(m.group(0))


# --------------------------------------------------------------------------- rendering
def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError("ffmpeg failed:\n" + p.stderr[-3000:])


def probe_duration(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    return float(p.stdout.strip() or 0)


def render_scene(tpl, tdir, scene, fields, work, idx):
    fps = Fraction(tpl["fps"])
    start = scene["start_frame"] / fps
    nframes = scene["end_frame"] - scene["start_frame"]
    dur = nframes / fps
    fo = tpl.get("text_fade_out_frames", 14) / fps
    fonts = {k: FONTS / v for k, v in tpl["fonts"].items()}
    fmt = defaultdict(str, fields)

    pngs = []
    for k, s in enumerate(scene["slots"]):
        p = work / f"s{idx}_{k}.png"
        if s.get("type") == "divider":
            w, h = divider_png(s.get("width", 300), p)
        else:
            text = s["text"].format_map(fmt).strip()
            if not text:
                continue
            w, h = text_png(text, fonts[s["font"]], s["size"], s.get("max_width"), p)
        pngs.append((p, w, h, s))

    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", f"{float(start):.6f}", "-t", f"{float(dur):.6f}",
           "-i", str(tdir / tpl["background"])]
    for p, *_ in pngs:
        cmd += ["-loop", "1", "-framerate", tpl["fps"], "-t", f"{float(dur):.6f}", "-i", str(p)]
    fc = [f"[0:v]fps={tpl['fps']},setpts=PTS-STARTPTS,format=yuv420p[b0]"]
    for k, (p, w, h, s) in enumerate(pngs, 1):
        tin = float(s["in"] / fps)
        d = max(float(s.get("dur", 22) / fps), 0.1)
        tout = float(dur - fo)
        x = int(round(s["x"] - w / 2))
        y = int(round(s["y"] - h / 2))
        fc.append(f"[{k}:v]format=rgba,fade=t=in:st={tin:.3f}:d={d:.3f}:alpha=1,"
                  f"fade=t=out:st={tout:.3f}:d={float(fo):.3f}:alpha=1[t{k}]")
        fc.append(f"[b{k-1}][t{k}]overlay=x={x}:y='{y}+14*max(0,1-(t-{tin:.3f})/{d:.3f})':eval=frame[b{k}]")
    out = work / f"scene_{idx:02d}.mp4"
    cmd += ["-filter_complex", ";".join(fc), "-map", f"[b{len(pngs)}]", "-an",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", str(out)]
    run(cmd)
    return out, float(dur)


def build_scene_list(tpl, job_fields, events):
    """Expands repeating scenes. Returns [(scene, fields, transition_in)]."""
    items = []
    for sc in tpl["scenes"]:
        if sc.get("repeat") == "events":
            for i, ev in enumerate(events):
                f = dict(job_fields)
                f.update({k: v for k, v in ev.items() if v is not None})
                tr = sc.get("transition_in", "cut") if i == 0 else sc.get("transition_between", "fadewhite")
                items.append((sc, f, tr))
        else:
            items.append((sc, job_fields, sc.get("transition_in", "cut")))
    return items


def join_scenes(tpl, clips, music, out_path):
    """clips: [(path, dur, transition_in)]"""
    TR = {"fade": ("fade", 0.4), "fadewhite": ("fadewhite", 0.5)}
    cmd = ["ffmpeg", "-v", "error", "-y"]
    for p, _, _ in clips:
        cmd += ["-i", str(p)]
    fc = []
    for i in range(len(clips)):
        fc.append(f"[{i}:v]settb=AVTB,fps={tpl['fps']},format=yuv420p[v{i}]")
    acc, length = "v0", clips[0][1]
    for i in range(1, len(clips)):
        _, d_i, tr = clips[i]
        nxt = f"j{i}"
        if tr in TR:
            name, d = TR[tr]
            fc.append(f"[{acc}][v{i}]xfade=transition={name}:duration={d}:offset={length - d:.4f},settb=AVTB,fps={tpl['fps']}[{nxt}]")
            length += d_i - d
        else:
            fc.append(f"[{acc}][v{i}]concat=n=2:v=1:a=0,settb=AVTB,fps={tpl['fps']}[{nxt}]")
            length += d_i
        acc = nxt
    amap = []
    if music and Path(music).exists():
        mdur = probe_duration(music)
        offset = max(0.0, mdur - length) if tpl.get("music_align", "end") == "end" else 0.0
        cmd += ["-ss", f"{offset:.3f}", "-i", str(music)]
        fade_in = "afade=t=in:d=1.0," if offset > 0 else ""
        fc.append(f"[{len(clips)}:a]{fade_in}afade=t=out:st={max(0, length - 1.5):.3f}:d=1.5,"
                  f"atrim=0:{length:.3f}[a]")
        amap = ["-map", "[a]", "-c:a", "aac", "-b:a", "192k"]
    cmd += ["-filter_complex", ";".join(fc), "-map", f"[{acc}]"] + amap + [
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "-t", f"{length:.3f}", str(out_path)]
    run(cmd)
    return length


def render_job(job, out_path, preview_path=None):
    tname = job.get("template") or "rose_gold"
    tdir = TEMPLATES / tname
    if not (tdir / "template.json").exists():
        have = ", ".join(n for n, _ in list_templates())
        raise ValueError(f"Unknown template '{tname}'. Installed: {have}")
    tpl = json.loads((tdir / "template.json").read_text(encoding="utf-8"))

    category = job.get("category") or tpl.get("category", "marriage")
    cat = load_categories().get(category, {})
    fields, events = dict(cat.get("defaults", {})), []
    fields.update(tpl.get("defaults", {}))
    if job.get("card_image_url") and not job.get("skip_card_reading"):
        got = read_card(job["card_image_url"], category, job.get("ai_quality", "accurate"))
        fields.update({k: v for k, v in got.get("fields", {}).items() if v is not None})
        events = got.get("events", [])
        job["extracted_from_card"] = got  # kept in the result so the app can show/edit it
    fields.update({k: v for k, v in (job.get("fields") or {}).items() if isinstance(v, str) and v.strip()})
    if job.get("events"):
        events = job["events"]
    if not events and any(s.get("repeat") == "events" for s in tpl["scenes"]):
        raise ValueError("Job has no events (date/venue).")

    work = Path(tempfile.mkdtemp(prefix="invite_"))
    try:
        clips = []
        for i, (sc, f, tr) in enumerate(build_scene_list(tpl, fields, events)):
            log(f"scene {i + 1}: {sc['id']}")
            p, d = render_scene(tpl, tdir, sc, f, work, i)
            clips.append((p, d, tr))
        length = join_scenes(tpl, clips, tdir / tpl["music"] if tpl.get("music") else None, out_path)
        log(f"done: {out_path} ({length:.1f}s)")
        if preview_path:
            make_watermarked(out_path, preview_path, work)
        return out_path
    finally:
        shutil.rmtree(work, ignore_errors=True)


def make_watermarked(src, dst, work):
    """Smaller copy with a repeated 'Preview' mark: what customers see before paying."""
    W, H = 540, 960
    mark = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(mark)
    f = _font(FONTS / "Cinzel-VF.ttf", 24)
    label = "PREVIEW  \u2022  QUICK INVITATIONS"
    tw = int(d.textlength(label, font=f)) + 30
    tile = Image.new("RGBA", (tw, 50), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((15, 10), label, font=f, fill=(255, 255, 255, 105))
    tile = tile.rotate(28, expand=True, resample=Image.BICUBIC)
    for row, y in enumerate(range(-250, H + 100, 230)):
        for x in range(-tile.width, W + tile.width, tile.width + 40):
            mark.alpha_composite(tile, (x + (row % 2) * (tile.width // 2), y))
    d.rectangle([0, H - 70, W, H], fill=(36, 25, 27, 190))
    f2 = _font(FONTS / "Figtree-SemiBold.ttf", 22) if (FONTS / "Figtree-SemiBold.ttf").exists() else _font(FONTS / "Playfair-VF.ttf", 22)
    msg = "Preview \u2013 unlock to download the full video"
    while d.textlength(msg, font=f2) > W - 40 and f2.size > 12:
        f2 = f2.font_variant(size=f2.size - 1)
    mw = d.textlength(msg, font=f2)
    d.text(((W - mw) / 2, H - 47), msg, font=f2, fill=(245, 222, 160, 255))
    mp = Path(work) / "watermark.png"
    mark.save(mp)
    run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-i", str(mp), "-filter_complex",
         f"[0:v]scale={W}:{H}[v];[v][1:v]overlay=0:0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
         "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(dst)])
    return dst


def job_id_of(job, fallback):
    jid = job.get("id") or fallback
    return re.sub(r"[^A-Za-z0-9_-]+", "-", jid).strip("-") or "invite"


# --------------------------------------------------------------------------- template catalog
def list_templates():
    out = []
    for tj in sorted(TEMPLATES.glob("*/template.json")):
        tpl = json.loads(tj.read_text(encoding="utf-8"))
        if not (tj.parent / tpl.get("background", "background.mp4")).exists():
            log(f"skipping design '{tj.parent.name}': its background video is missing")
            continue
        out.append((tj.parent.name, tpl))
    return sorted(out, key=lambda t: (t[1].get("order", 100), t[0]))


def sample_fields(category=None):
    cat = load_categories().get(category or "", {})
    if cat.get("sample"):
        f = dict(cat.get("defaults", {}))
        f.update(cat["sample"].get("fields", {}))
        return f, cat["sample"].get("events", [])
    job = json.loads((ROOT / "jobs" / "sample_job.json").read_text(encoding="utf-8"))
    return job.get("fields", {}), job.get("events", [])


def make_preview(name, force=False):
    """Renders the template's preview scene with the sample details and saves
    preview.jpg (still) and preview.mp4 (short muted loop for the design picker)."""
    tdir = TEMPLATES / name
    tpl = json.loads((tdir / "template.json").read_text(encoding="utf-8"))
    out, clip_out = tdir / "preview.jpg", tdir / "preview.mp4"
    newest = max((tdir / f).stat().st_mtime for f in ("template.json", tpl["background"]))
    for sample in (ROOT / "jobs" / "sample_job.json", ROOT / "categories.json"):
        if sample.exists():
            newest = max(newest, sample.stat().st_mtime)
    if (not force and out.exists() and clip_out.exists()
            and min(out.stat().st_mtime, clip_out.stat().st_mtime) > newest):
        return out
    fields, events = sample_fields(tpl.get("category"))
    merged = dict(tpl.get("defaults", {}))
    merged.update(fields)
    scene_id = tpl.get("preview_scene", tpl["scenes"][0]["id"])
    scene = next(sc for sc in tpl["scenes"] if sc["id"] == scene_id)
    if scene.get("repeat") == "events" and events:
        merged.update(events[0])
    work = Path(tempfile.mkdtemp(prefix="preview_"))
    try:
        clip, dur = render_scene(tpl, tdir, scene, merged, work, 0)
        at = dur * tpl.get("preview_at", 0.7)
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{at:.3f}", "-i", str(clip), "-frames:v", "1",
             "-vf", "scale=540:-2", "-q:v", "3", str(out)])
        # small looping clip: whole preview scene, 360x640, no sound (~0.5-1 MB)
        # skip the scene's opening flash/fade and stop before its fade-out, so every loop shows the design
        c0, c1 = min(0.9, dur * 0.12), max(dur - 0.8, dur * 0.6)
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{c0:.2f}", "-t", f"{c1 - c0:.2f}", "-i", str(clip),
             "-an", "-vf", "scale=360:-2,fps=24",
             "-c:v", "libx264", "-profile:v", "main", "-preset", "slow", "-crf", "30",
             "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(clip_out)])
    finally:
        shutil.rmtree(work, ignore_errors=True)
    log("preview ready:", out, f"+ clip ({clip_out.stat().st_size // 1024} KB)")
    return out


def publish_templates():
    """Uploads every template's preview and a catalog.json that the app reads to show the choices."""
    import cloudinary.uploader
    base = os.environ.get("INVITE_CLOUDINARY_FOLDER", "invites").strip("/")
    catalog = []
    for name, tpl in list_templates():
        prev = make_preview(name)
        up = cloudinary.uploader.upload(str(prev), public_id=f"{base}/templates/{name}", overwrite=True,
                                        invalidate=True, resource_type="image")
        entry = {
            "id": name,
            "title": tpl.get("title", name.replace("_", " ").title()),
            "description": tpl.get("description", ""),
            "category": tpl.get("category", "marriage"),
            "tags": tpl.get("tags", []),
            "order": tpl.get("order", 100),
            "preview_url": up["secure_url"],
        }
        clip = prev.with_suffix(".mp4")
        if clip.exists():
            upv = cloudinary.uploader.upload(str(clip), public_id=f"{base}/templates/{name}_preview",
                                             overwrite=True, invalidate=True, resource_type="video")
            entry["preview_video_url"] = upv["secure_url"]
        catalog.append(entry)
    tmp = OUTPUT / "_catalog.json"
    OUTPUT.mkdir(exist_ok=True)
    tmp.write_text(json.dumps({"templates": catalog, "updated": time.strftime("%Y-%m-%dT%H:%M:%S")},
                              indent=2, ensure_ascii=False), encoding="utf-8")
    cloudinary.uploader.upload(str(tmp), resource_type="raw", public_id=f"{base}/templates/catalog.json",
                               overwrite=True, invalidate=True)
    if api_enabled():
        cats = [c for c in load_categories().values()]
        api_post("/api/worker/catalog", {"categories": cats, "templates": catalog})
        log("sent the design list to", os.environ["INVITE_API_URL"])
    log(f"published {len(catalog)} template(s): " + ", ".join(t["id"] for t in catalog))
    return catalog


# --------------------------------------------------------------------------- app server (orders queue)
def api_enabled():
    return bool(os.environ.get("INVITE_API_URL", "").strip() and os.environ.get("WORKER_SECRET", "").strip())


def api_post(path, data, timeout=60):
    url = os.environ["INVITE_API_URL"].rstrip("/") + path
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), method="POST", headers={
        "Content-Type": "application/json", "Authorization": "Bearer " + os.environ["WORKER_SECRET"].strip(),
        "User-Agent": "invite-worker"})
    with urllib.request.urlopen(req, timeout=timeout) as fh:
        return json.loads(fh.read().decode("utf-8") or "{}")


def mode_api(interval):
    """Takes paid-for orders from the app server, renders them, uploads a watermarked preview
    and the clean video (at an unguessable address) and reports back."""
    import secrets
    import cloudinary.uploader
    base = os.environ.get("INVITE_CLOUDINARY_FOLDER", "invites").strip("/")
    OUTPUT.mkdir(exist_ok=True)
    try:
        publish_templates()
    except Exception:
        log("could not publish the design list:")
        traceback.print_exc()
    log(f"taking orders from {os.environ['INVITE_API_URL']} every {interval}s")
    while True:
        try:
            job = api_post("/api/worker/next", {}).get("job")
        except Exception as e:
            log("server not reachable:", e)
            time.sleep(interval)
            continue
        if not job:
            time.sleep(interval)
            continue
        jid = job_id_of(job, "order")
        log("order", jid, job.get("category"), job.get("template"))
        out, prev = OUTPUT / f"{jid}.mp4", OUTPUT / f"{jid}_preview.mp4"
        try:
            render_job(job, out, preview_path=prev)
            upp = cloudinary.uploader.upload_large(str(prev), resource_type="video",
                                                   public_id=f"{base}/previews/{jid}", overwrite=True)
            upf = cloudinary.uploader.upload_large(str(out), resource_type="video", overwrite=True,
                                                   public_id=f"{base}/final/{jid}-{secrets.token_hex(12)}")
            api_post("/api/worker/complete", {"id": job["id"], "preview_url": upp["secure_url"],
                                              "final_url": upf["secure_url"],
                                              "extracted": job.get("extracted_from_card")})
            log("ready", jid)
        except Exception as e:
            traceback.print_exc()
            try:
                api_post("/api/worker/fail", {"id": job["id"], "error": str(e)[:480]})
            except Exception:
                traceback.print_exc()
        finally:
            for f in (out, prev):
                f.unlink(missing_ok=True)


# --------------------------------------------------------------------------- modes
def mode_run(path):
    job = json.loads(Path(path).read_text(encoding="utf-8"))
    OUTPUT.mkdir(exist_ok=True)
    out = OUTPUT / f"{job_id_of(job, Path(path).stem)}.mp4"
    render_job(job, out)
    print(out)


def mode_watch_folder(folder, interval):
    folder = Path(folder)
    for sub in ("done", "failed"):
        (folder / sub).mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(exist_ok=True)
    log("watching", folder)
    while True:
        for jf in sorted(folder.glob("*.json")):
            try:
                job = json.loads(jf.read_text(encoding="utf-8"))
                out = OUTPUT / f"{job_id_of(job, jf.stem)}.mp4"
                render_job(job, out)
                shutil.move(str(jf), folder / "done" / jf.name)
            except Exception:
                log("FAILED", jf.name)
                traceback.print_exc()
                (folder / "failed" / (jf.stem + ".error.txt")).write_text(traceback.format_exc())
                shutil.move(str(jf), folder / "failed" / jf.name)
        time.sleep(interval)


def mode_watch_cloudinary(interval):
    import cloudinary, cloudinary.api, cloudinary.uploader  # reads CLOUDINARY_URL from the environment
    if not os.environ.get("CLOUDINARY_URL"):
        sys.exit("Set CLOUDINARY_URL in .env (Cloudinary dashboard > API Keys).")
    if api_enabled():
        return mode_api(interval)
    base = os.environ.get("INVITE_CLOUDINARY_FOLDER", "invites").strip("/")
    pending, processing, done, failed = (f"{base}/jobs/{s}" for s in ("pending", "processing", "done", "failed"))
    videos = f"{base}/videos"
    OUTPUT.mkdir(exist_ok=True)
    try:
        publish_templates()
    except Exception:
        log("could not publish the template list (the app will show only the default design):")
        traceback.print_exc()
    log(f"polling Cloudinary for raw files under {pending}/ every {interval}s")

    def upload_json(obj, public_id):
        tmp = OUTPUT / "_result.json"
        tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")
        return cloudinary.uploader.upload(str(tmp), resource_type="raw", public_id=public_id, overwrite=True)

    while True:
        try:
            res = cloudinary.api.resources(type="upload", resource_type="raw", prefix=pending + "/", max_results=50)
            items = sorted(res.get("resources", []), key=lambda r: r.get("created_at", ""))
        except Exception:
            traceback.print_exc()
            items = []
        for r in items:
            pid = r["public_id"]
            name = pid.split("/")[-1]
            stem = name[:-5] if name.endswith(".json") else name
            try:  # claim the job; fails if another worker already took it
                claimed = cloudinary.uploader.rename(pid, f"{processing}/{name}", resource_type="raw")
            except Exception:
                continue
            try:
                with urllib.request.urlopen(claimed["secure_url"]) as fh:
                    job = json.loads(fh.read().decode("utf-8"))
                jid = job_id_of(job, stem)
                log("job", jid)
                out = OUTPUT / f"{jid}.mp4"
                render_job(job, out)
                up = cloudinary.uploader.upload_large(str(out), resource_type="video",
                                                      public_id=f"{videos}/{jid}", overwrite=True)
                job.update(status="done", video_url=up["secure_url"], finished_at=time.strftime("%Y-%m-%dT%H:%M:%S"))
                upload_json(job, f"{done}/{jid}.result.json")
                cloudinary.uploader.destroy(claimed["public_id"], resource_type="raw")
                log("uploaded", up["secure_url"])
            except Exception as e:
                traceback.print_exc()
                try:
                    upload_json({"status": "failed", "error": str(e), "job_file": claimed.get("secure_url")},
                                f"{failed}/{stem}.result.json")
                    cloudinary.uploader.rename(claimed["public_id"], f"{failed}/{name}", resource_type="raw",
                                               overwrite=True)
                except Exception:
                    traceback.print_exc()
        time.sleep(interval)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="mode", required=True)
    a = sub.add_parser("run"); a.add_argument("job")
    b = sub.add_parser("watch-folder"); b.add_argument("folder"); b.add_argument("--interval", type=int, default=5)
    c = sub.add_parser("watch-cloudinary"); c.add_argument("--interval", type=int, default=10)
    sub.add_parser("previews", help="make preview.jpg for every template (local only)")
    sub.add_parser("publish-templates", help="upload previews + catalog.json so the app lists the designs")
    args = ap.parse_args()
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found. Install it and make sure it is on PATH (see README).")
    if args.mode == "run":
        mode_run(args.job)
    elif args.mode == "previews":
        for name, _ in list_templates():
            print(make_preview(name, force=True))
    elif args.mode == "publish-templates":
        publish_templates()
    elif args.mode == "watch-folder":
        mode_watch_folder(args.folder, args.interval)
    else:
        mode_watch_cloudinary(args.interval)


if __name__ == "__main__":
    main()
