# Invitation video maker

Turns a photo of a printed invitation card, or typed details, into an animated invitation video
to share on WhatsApp.

```
Phone / website (app/) ──job──▶ Cloudinary ──▶ Rendering PC (worker/) ──video──▶ Cloudinary ──▶ app
```

| Folder | What it is |
|---|---|
| [`app/`](app/README.md) | Expo / React Native app. Runs on Android, iPhone (Expo Go) and as a website on Vercel |
| [`worker/`](worker/README.md) | Python + FFmpeg renderer that runs on a Windows/Mac/Linux PC and makes the videos |
| `tools/` | Helper used to generate the emerald_gold background (example for making new templates) |

## Quick start
1. **Worker PC:** `worker/setup.bat` (Windows) or `bash worker/setup.sh`, then fill in `worker/.env`
   (see `.env.example`). It publishes the list of designs to Cloudinary when it starts.
2. **Cloudinary:** create an **unsigned upload preset** `invites_unsigned` (see `app/README.md`).
3. **App:** `cd app && npm install && npx expo start` (scan with Expo Go), or deploy `app/` to Vercel.

## Not in this repo (on purpose)
- `worker/templates/rose_gold/background.mp4` and any `music.m4a`: these come from third-party
  material and must not be public. Copy them into the same paths on the worker PC. Without music,
  videos are silent.
- `.env` files: Cloudinary keys and the Anthropic API key stay on your machines and in Vercel settings.

Templates can be added in `worker/templates/` (see the worker README). The app picks them up automatically.
