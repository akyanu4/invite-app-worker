# Invitation Videos (mobile app)

Expo / React Native app for Android and iPhone. It sends an invitation (a card photo or typed
details) to Cloudinary. Your rendering PC (`invite_worker`) makes the video, and the app plays it,
shares it to WhatsApp and saves it to the gallery.

```
Phone app ──upload job──▶ Cloudinary invites/jobs/pending/ ──▶ PC worker renders
    ▲                                                              │
    └──── polls invites/jobs/done/<id>.result.json ◀── video ──────┘
```

## 1. One-time Cloudinary setup: an unsigned upload preset

The app never holds your API secret. It uploads through an *unsigned upload preset*.

1. Cloudinary console → **Settings** (gear) → **Upload** → **Upload presets** → **Add upload preset**.
2. **Upload preset name:** `invites_unsigned`
3. **Signing mode:** **Unsigned**
4. Leave **Folder / Asset folder** empty. The app puts the full path in the public ID.
5. Turn **off** "Use filename" / "Unique filename" if shown. Leave Overwrite off.
6. Save.

## 2. Run it on your phone (no Android Studio needed)

On your PC:
1. Install **Node.js LTS** from nodejs.org.
2. Unzip this folder, open a terminal in it, and run:
   ```
   npm install
   npx expo start
   ```
   A QR code appears.

On your phone:
3. Install **Expo Go** from the Play Store or App Store.
4. Android: open Expo Go and scan the QR code. iPhone: scan it with the Camera app.

The phone and PC must be on the same Wi-Fi. If they aren't, or it won't connect, use
`npx expo start --tunnel`.

5. In the app: **Settings** → your cloud name, preset `invites_unsigned`, folder `invites` →
   **Save & test connection**. It should say "Connected".

Tip: copy `.env.example` to `.env` and fill in your cloud name, so it's pre-filled in the app.

## 3. Using it

- **Choose a design:** after picking card or typed details, you choose a design. The list and
  preview pictures come from the PC worker, so new designs added there appear automatically.
- **Scan a printed card:** take or pick a photo. The PC reads the card with AI (it needs
  `ANTHROPIC_API_KEY` in the worker's `.env`) and makes the video. Afterwards, **Fix the details &
  remake** opens everything that was read, so you can correct it.
- **Type the details:** fill the form (tap **Example** for a filled-in sample). Add one event card
  per function (Nikah, Valima…).
- **Result:** plays the video. **Share on WhatsApp** opens the share menu with the MP4.
  **Save to gallery** stores it on the phone.
- **Your videos:** past videos stay on the home screen. Long-press one to remove it.

## 3b. Website on Vercel

The same code runs as a website. Anyone opens the link on Android or iPhone, with no install.
1. Vercel → **Add New → Project** → import this GitHub repo.
2. **Root Directory:** `app` (the build settings come from `app/vercel.json`).
3. **Environment Variables:** `EXPO_PUBLIC_CLOUDINARY_CLOUD` = your cloud name,
   `EXPO_PUBLIC_CLOUDINARY_PRESET` = `invites_unsigned`, `EXPO_PUBLIC_CLOUDINARY_FOLDER` = `invites`.
4. **Deploy.** Every push to `main` redeploys automatically.

On the website, "Share on WhatsApp" opens the phone's share menu with the video file. On iPhone,
saving goes through Share → Save Video.

## 4a. Build an APK on your own PC (no account)

Double-click **`build_apk.bat`**. It downloads Java 17 and the Android SDK into `C:\android-build`
(about 3-4 GB), builds the app and leaves **`InvitationVideos.apk`** in this folder. The first run takes
20-45 minutes; later runs take a few minutes. Copy the APK to the phone, tap it, and allow
"Install unknown apps".

Tip: build from a short path such as `C:\ia`, because long Windows paths can break Android builds.

## 4b. Build in Expo's cloud (free Expo account)

Expo builds it in the cloud. No Android Studio or Xcode is needed.
```
npm install -g eas-cli
eas login                                  # free Expo account (expo.dev)
eas build -p android --profile preview     # ~10-20 min in Expo's cloud, then gives an .apk download link + QR
```
For the Play Store use `--profile production` (an .aab file). iPhone builds need an Apple Developer
account ($99/year).

## 5. Project layout

| File | What it does |
|---|---|
| `App.tsx` | Screen switching (home → design → card/details → progress → result, settings) |
| `src/cloudinary.ts` | Uploads (unsigned), job submit, result polling |
| `src/fields.ts` | Form fields; must match the template's text slots on the worker |
| `src/screens/*` | The six screens |
| `src/storage.ts` | Settings and video history on the phone |

Adding fields: add them to `src/fields.ts` **and** to a slot in the worker's
`templates/<name>/template.json`.

## Notes

- Anyone who has your preset name can upload to your Cloudinary account. That's fine for family
  use. For a public app, sign uploads from a small server (e.g. a Vercel function) instead.
- Job IDs are random and hard to guess, but videos are public links.
- Type-checked and bundled for Android and iOS, but not yet run on a device. Try it in Expo Go first.
