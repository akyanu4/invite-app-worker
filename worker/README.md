# Invitation video worker

Runs on your own PC. It picks up invitation jobs, renders an animated WhatsApp
invitation video from a template, and saves or uploads the MP4.

A job is either:
- **typed details**: names, parents, events (see `jobs/sample_job.json`), or
- **a photo of a printed card**: `card_image_url` (see `jobs/sample_card_job.json`). The card is read
  with the Claude API, and any `fields` you also send override what was read.

## Quick setup

**Windows:** unzip to `C:\invite_worker` and double-click **`setup.bat`**. It installs Python and
FFmpeg (with winget) if they're missing, sets up the worker, renders a test video, and can make the
worker start at every boot and stop the PC from sleeping. Then fill in `.env`.

**macOS / Linux:** `bash setup.sh`

Background worker (Windows, after setup with auto start):
- log: `logs\worker.log`
- **restart after an update:** double-click `restart_worker.bat` (asks for Administrator).
  `schtasks /End` alone stops the task but leaves the old Python worker running.
- remove auto start: `schtasks /Delete /TN InvitationVideoWorker /F`

**Updating:** unzip or copy the new files *into* this folder (replace when asked), not into a new
`invite_worker` folder inside it, then run `restart_worker.bat`. The log should then show
`published N template(s)`.

## 1. Manual install (Windows)

1. Install **Python 3.11+** from python.org. Tick "Add python.exe to PATH".
2. Install **FFmpeg**. Open PowerShell and run `winget install Gyan.FFmpeg`, then open a new terminal
   and check `ffmpeg -version`.
3. In this folder:
   ```
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```
4. Copy `.env.example` to `.env` and fill in the keys you need.

(macOS/Linux: same steps with `brew install ffmpeg` / `apt install ffmpeg` and `source .venv/bin/activate`.)

## 2. Try it

```
python worker.py run jobs/sample_job.json
```
The video appears in `output/sample-valima.mp4` (about 1–2 minutes on a Ryzen 7).

## 3. Three ways to run it

| Command | What it does |
|---|---|
| `python worker.py run job.json` | Render one job file now |
| `python worker.py watch-folder jobs/inbox` | Render every `.json` dropped into that folder. Done jobs move to `inbox/done`, failed ones to `inbox/failed` with the error |
| `python worker.py watch-cloudinary` | Poll Cloudinary for new jobs and upload the finished video (below) |

## 4. Testing the Cloudinary flow

With `.env` filled in and the worker running:
```
.venv\Scripts\python test_cloudinary.py                 # sends jobs\sample_job.json
.venv\Scripts\python test_cloudinary.py --card card.jpg # sends a card photo instead
```
It uploads a job like the app would, waits for the worker, and downloads the video into `output\`.

## 5. Taking orders from the website (Quick Invitations)

Add these to `.env` and run `restart_worker.bat`:
```
INVITE_API_URL=https://quickinvitations.vercel.app
WORKER_SECRET=<same value as WORKER_SECRET in Vercel>
```
`watch-cloudinary` then takes orders from the website instead of Cloudinary job files (no change
to the scheduled task is needed). When idle it checks every 15 minutes (`INVITE_IDLE_POLL_MINUTES`) so
the free database can sleep; after an order it checks every 10 s for 5 minutes. For each order it:
- reads the card photo if there is one, using `ai_quality`: "accurate" uses `INVITE_AI_MODEL`
  (default claude-sonnet-5-5), "approximate" uses `INVITE_AI_MODEL_FAST` (default claude-haiku-5-5),
- renders the video,
- uploads a small watermarked preview to `invites/previews/<id>` and the clean video to
  `invites/final/<id>-<random>` (the website only shows that address after payment),
- reports back to the website. On start-up it also sends the design list and the occasion forms
  (`categories.json`).

## 5b. Older Cloudinary job-file flow

Set `CLOUDINARY_URL` in `.env` (Cloudinary console → API Keys → "API environment variable").

1. **App uploads the card photo** (optional) as an image, e.g. `invites/cards/abc.jpg`, and gets its URL.
2. **App uploads the job** as a *raw* file with public ID `invites/jobs/pending/<job-id>.json`.
   The body is the same JSON as `jobs/sample_job.json`, with `card_image_url` if a card was used.
3. **Worker** (on your PC) checks every 10 s and:
   - moves the job to `invites/jobs/processing/` (so two PCs never take the same job),
   - reads the card if needed, renders the video,
   - uploads the video to `invites/videos/<job-id>`,
   - writes `invites/jobs/done/<job-id>.result.json` with `"status": "done"` and `"video_url"`.
   On error it writes `invites/jobs/failed/<job-id>.result.json` with the error message.
4. **App polls** `https://res.cloudinary.com/<cloud>/raw/upload/invites/jobs/done/<job-id>.result.json`
   until it exists, then downloads `video_url` and opens the WhatsApp share sheet.

Notes:
- Cloudinary blocks uploading with your API secret from a phone. Use an **unsigned upload preset**
  restricted to the `invites/` folder, or sign uploads from a tiny API (e.g. on Vercel).
- Job files and videos uploaded this way are reachable by anyone with the link. Use random job IDs
  (e.g. UUIDs), or switch to authenticated delivery if that matters to you.
- Newer Cloudinary accounts use "dynamic folders". The worker matches on the public ID prefix, so
  always put the full path (`invites/jobs/pending/...`) in the **public ID** when uploading.
- Change the `invites` prefix with `INVITE_CLOUDINARY_FOLDER` in `.env`.

## 6. Start automatically with Windows

Edit the path in `start_worker.bat`, press Win+R, type `shell:startup`, and put a shortcut to it
there. Also set Windows power options so the PC never sleeps.

## 7. Occasions and job fields

`categories.json` defines each occasion (marriage, birthday, cradle, baby_shower): the form the
website shows, fixed wording (`defaults`), the sample used for previews, and what the card reader
looks for. Each template says which occasion it belongs to with `"category"`.

Marriage fields:
Couple card: `couple_title`, `groom_short`, `couple_joiner` (default "with"), `bride_short`, `couple_line`
Groom: `groom_label`, `groom_name`, `groom_nickname`, `groom_relation` (S/O), `groom_parents_label`, `groom_father`
Bride: `bride_label`, `bride_name`, `bride_relation` (D/O), `bride_parents_label`, `bride_father`
Save the date: `save_line1`, `save_title`, `save_days`, `save_dates`
Events (one card each, in order): `title`, `date`, `time`, `venue`, `address1`, `address2`

Birthday, cradle ceremony and baby shower fields are listed in `categories.json`.

An empty value (`""`) leaves that line out. Text shrinks automatically to fit its width.

## 8. Templates (designs)

Included:
- Marriage: **rose_gold** (roses and gold ring), **emerald_gold** (green with a gold mandala and sparkles)
- Birthday: **birthday_confetti** (navy with falling confetti)
- Cradle ceremony: **cradle_moonlight** (crescent moon, stars and clouds)
- Baby shower: **babyshower_blush** (blush pink with bubbles and hearts)

The backgrounds for the last four are made by `tools/make_background.py` and their music by
`tools/make_music.py` (both generated here, so free to use). The layouts of the last three come from
`tools/make_category_templates.py`.

The app shows every installed design with a preview picture. When `watch-cloudinary` starts, the
worker renders a preview for each template and uploads it plus `invites/templates/catalog.json`.
After adding or changing a template, run `python worker.py publish-templates` (or restart the worker).

To add a design, make a folder in `templates/` with:
- `background.mp4`: the animated background, 1080x1920, **with no text on it**
- `music.m4a`: optional
- `template.json`: copy one of the existing ones and change:
  - `category`: which occasion it belongs to (an id from `categories.json`)
  - `title`, `description`, `tags`, `order`: how it appears in the app (`tags` become the style filters)
  - `scenes`: frame ranges in the background for each card (couple, groom, bride, event, save). A
    scene with `"repeat": "events"` is shown once per event. Transitions: `cut`, `fade`, `fadewhite`.
  - `slots`: each text line (which field, font `script`/`caps`/`serif`, size, centre x/y, max width,
    the frame it appears on). Keep the same field names so every design works with the same form.
  - `preview_scene` / `preview_at`: which scene and moment the preview picture shows

`python worker.py previews` makes the preview pictures locally, so you can check a new layout
without uploading anything.

Fonts: Great Vibes, Cinzel and Playfair Display (SIL Open Font License, see `fonts/`).
The rose_gold background and both templates' music come from a purchased/downloaded invitation video.
That's fine for family use, but get licensed music before selling or publishing an app. The
emerald_gold background was generated for this project and is yours to use.
