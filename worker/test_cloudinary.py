#!/usr/bin/env python3
"""
End-to-end test of the Cloudinary flow - does exactly what the phone app will do.

  .venv\\Scripts\\python test_cloudinary.py                     # send jobs\\sample_job.json
  .venv\\Scripts\\python test_cloudinary.py --job my_job.json   # send your own job file
  .venv\\Scripts\\python test_cloudinary.py --card card.jpg     # send a card photo (needs ANTHROPIC_API_KEY)

Steps: uploads the job to invites/jobs/pending/, waits for the worker (running on this or any
other PC) to finish, then downloads the video into output\\.
The worker must be running: the background task, or `python worker.py watch-cloudinary`.
"""
import argparse, json, os, sys, time, urllib.request, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

url = os.environ.get("CLOUDINARY_URL", "")
if not url.startswith("cloudinary://") or "API_KEY:API_SECRET" in url:
    sys.exit("CLOUDINARY_URL in .env is missing or still the example. Fill it in first "
             "(Cloudinary console > Settings > API Keys > 'API environment variable').")

import cloudinary, cloudinary.api, cloudinary.uploader  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--job", default=str(ROOT / "jobs" / "sample_job.json"))
ap.add_argument("--card", help="photo of a printed invitation card")
ap.add_argument("--timeout", type=int, default=600, help="seconds to wait for the worker")
args = ap.parse_args()

base = os.environ.get("INVITE_CLOUDINARY_FOLDER", "invites").strip("/")
job_id = "test-" + time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]

# 1. connection check
print("1. Checking the Cloudinary connection...")
try:
    cloudinary.api.ping()
except Exception as e:
    sys.exit(f"   Could not connect: {e}\n   Check CLOUDINARY_URL in .env.")
print("   OK, cloud:", cloudinary.config().cloud_name)

# 2. build the job
if args.card:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("   Note: ANTHROPIC_API_KEY is empty in .env on this PC. The worker PC needs it to read cards.")
    print("2. Uploading the card photo...")
    up = cloudinary.uploader.upload(args.card, public_id=f"{base}/cards/{job_id}", overwrite=True)
    job = {"id": job_id, "template": "rose_gold", "card_image_url": up["secure_url"], "fields": {}}
    print("   card:", up["secure_url"])
else:
    job = json.loads(Path(args.job).read_text(encoding="utf-8"))
    job["id"] = job_id
    print("2. Using job file", args.job)

# 3. send the job
tmp = ROOT / "output" / f"{job_id}.json"
tmp.parent.mkdir(exist_ok=True)
tmp.write_text(json.dumps(job, indent=2, ensure_ascii=False), encoding="utf-8")
cloudinary.uploader.upload(str(tmp), resource_type="raw", public_id=f"{base}/jobs/pending/{job_id}.json",
                           overwrite=True)
tmp.unlink()
print(f"3. Job sent: {base}/jobs/pending/{job_id}.json")

# 4. wait for the result
print("4. Waiting for the worker", end="", flush=True)
done_id, failed_id = f"{base}/jobs/done/{job_id}.result.json", f"{base}/jobs/failed/{job_id}.result.json"
start, picked_up = time.time(), False
while time.time() - start < args.timeout:
    time.sleep(5)
    print(".", end="", flush=True)
    if not picked_up:
        try:
            cloudinary.api.resource(f"{base}/jobs/pending/{job_id}.json", resource_type="raw")
        except Exception:
            picked_up = True
            print(" picked up, rendering", end="", flush=True)
    for pid, ok in ((done_id, True), (failed_id, False)):
        try:
            r = cloudinary.api.resource(pid, resource_type="raw")
        except Exception:
            continue
        with urllib.request.urlopen(r["secure_url"]) as fh:
            result = json.loads(fh.read().decode("utf-8"))
        print(f"\n   finished in {time.time() - start:.0f}s")
        if not ok:
            sys.exit("   FAILED: " + result.get("error", "unknown error") + "\n   (see logs\\worker.log on the worker PC)")
        video = result["video_url"]
        out = ROOT / "output" / f"{job_id}.mp4"
        urllib.request.urlretrieve(video, out)
        print("5. Video URL:", video)
        print("   Downloaded to:", out)
        if result.get("extracted_from_card"):
            print("   Read from the card:\n" + json.dumps(result["extracted_from_card"], indent=2, ensure_ascii=False))
        sys.exit(0)

if not picked_up:
    sys.exit("\n   No worker picked up the job. Is it running? Check logs\\worker.log, or run "
             "`schtasks /Run /TN InvitationVideoWorker`.")
sys.exit("\n   The worker took the job but didn't finish in time. Check logs\\worker.log.")
