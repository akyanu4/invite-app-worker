# Quick Invitations (website + mobile app)

Expo / React Native app that runs as a website (installable on the phone) and as an Android/iPhone app.
Customers pick an occasion and a design, type the details or photograph a printed card, watch a free
watermarked preview, then pay by UPI (or use a promo code) to unlock the full video for WhatsApp.

```
App / website ──▶ Vercel server (api/) ──▶ Postgres (orders, shops, promo codes)
                         ▲      │
          takes orders   │      ▼ catalog, prices
                     PC worker (invite_worker) ──▶ Cloudinary (previews, final videos, card photos)
```

- **Occasions:** Marriage (Nikah, Valima, Mehndi), Birthday, Cradle ceremony, Baby shower. Each has its own
  form. Designs can be filtered by style and sorted. Forms come from `worker/categories.json`.
- **Prices:** ₹200 for customers, ₹50 for approved shops (change with `PRICE_CUSTOMER` / `PRICE_SHOP`).
- **Payment:** the customer pays your UPI ID (QR code or "Pay with a UPI app"), enters the transaction ID
  (UTR), and you approve it in **Account → Admin**. The clean video unlocks straight away.
- **Promo codes:** create them in Admin. 100% makes the video free; you can limit uses and set a last day.
- **Shops:** register in **Account → Register a shop**; you approve them in Admin.
- **Card reading:** "Most accurate" (Claude Sonnet) or "Approximate" (Claude Haiku, faster and cheaper).

## 1. Vercel setup (once)

1. Vercel → your project → **Storage** → **Create Database** → **Neon (Postgres)** → connect it to this
   project. This adds `DATABASE_URL`. Tables are created automatically on first use.
2. **Settings → Environment Variables** (Production), then **Redeploy**:

| Name | Value |
|---|---|
| `SESSION_SECRET` | any long random text (40+ characters) |
| `ADMIN_PASSWORD` | the password you will use for Admin |
| `WORKER_SECRET` | another long random text; the same value goes in the worker's `.env` |
| `UPI_VPA` | your UPI ID, e.g. `yourname@okhdfcbank` |
| `UPI_NAME` | the name shown in UPI apps, e.g. `Quick Invitations` |
| `CLOUDINARY_URL` | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` (Cloudinary → API Keys) |
| `PRICE_CUSTOMER` | `200` |
| `PRICE_SHOP` | `50` |

The old `EXPO_PUBLIC_CLOUDINARY_*` variables are no longer used; you can delete them. Card photos are now
uploaded with a one-time signature from the server, so you can also delete the `invites_unsigned`
upload preset in Cloudinary.

**Charging money:** Vercel's free Hobby plan is for non-commercial use only. Move the project to the Pro
plan before taking payments.

## 2. Worker PC

Add to `C:\invite_worker\.env`:
```
INVITE_API_URL=https://quickinvitations.vercel.app
WORKER_SECRET=<same value as in Vercel>
ANTHROPIC_API_KEY=<only needed for card photos>
```
Then run `restart_worker.bat`. With these two lines set, the worker takes orders from the website
instead of Cloudinary job files, uploads a watermarked preview and the clean video, and sends the
design list and occasion forms to the site every time it starts.

## 3. Running the app on a phone

The website works on any phone: open it, then **Install** (Android Chrome) or Safari → Share →
**Add to Home Screen** (iPhone).

For the native app, set the server address when building: copy `.env.example` to `.env` with
`EXPO_PUBLIC_API_URL=https://quickinvitations.vercel.app`, then:

- **Expo Go:** `npm install`, `npx expo start`, scan the QR code with Expo Go.
- **APK on your PC:** double-click `build_apk.bat` (downloads Java 17 and the Android SDK into
  `C:\android-build`, 20-45 minutes the first time) and copy `InvitationVideos.apk` to the phone.
- **Expo's cloud:** `npx eas-cli@latest build -p android --profile preview` (free Expo account).
  iPhone builds need an Apple Developer account ($99/year).

## 4. Daily use (admin)

**Account → Admin** (at the bottom) → admin password.

- **Payments:** each payment waiting for you, with its UTR. Check it in your bank/UPI app, then
  **Approve** (unlocks the video) or **Not received** (the customer is asked to check the ID).
- **Shops:** approve or reject new shops. Approved shops pay the shop price while signed in.
- **Promo codes:** create, limit, and turn codes on or off.
- **Recent videos:** the last 50 orders with their status.

## 5. Running everything locally

```
npm install
npx expo export --platform web
PGLITE_DIR=.pglite SESSION_SECRET=dev ADMIN_PASSWORD=admin WORKER_SECRET=dev UPI_VPA=test@upi \
  CLOUDINARY_URL=cloudinary://1:2@demo npx tsx server/dev.ts      # http://localhost:8787
```
`server/dev.ts` serves the built site and the API with an in-folder Postgres (PGlite), so no database is
needed. Type checks: `npx tsc --noEmit` (app) and `npx tsc -p tsconfig.server.json` (server).

## 6. Project layout

| Path | What it does |
|---|---|
| `App.tsx` | Screen switching (home → design → card/details → preview → unlock; account, admin) |
| `api/index.ts` | The single Vercel function; passes every `/api/*` request to `server/routes.ts` |
| `server/routes.ts` | Orders, payments, promo codes, shops, admin, worker queue |
| `server/db.ts` | Postgres (Neon) connection and table setup |
| `server/security.ts` | Passwords, sign-in tokens, signed Cloudinary uploads |
| `src/api.ts` | The app's calls to the server |
| `src/categories.json` | Bundled copy of the occasion forms (from `worker/categories.json`) |
| `src/screens/*` | The screens |
| `src/storage.ts` | "Your videos", sign-ins and the device id on the phone |

Adding a form field: add it to the occasion in `worker/categories.json` (and copy that file to
`app/src/categories.json`) **and** to a text slot in the worker's `templates/<name>/template.json`.

## Notes

- The clean video's address is only given out after payment and contains a random part, so it can't be
  guessed from the preview.
- One phone can have at most 5 videos being made at once, to stop the queue being flooded.
- **Keeping the database free:** Neon's free plan includes 100 compute-hours a month, and the database
  only uses them while awake (it sleeps after ~5 minutes without requests). So the worker checks for
  new orders every 15 minutes when idle, and every few seconds for 5 minutes after an order.
  Customers see their place in the queue and that videos are usually ready within 20 minutes; they can
  close the app and find the video under "Your videos" later. Change the idle check with
  `INVITE_IDLE_POLL_MINUTES` in the worker's `.env` (below ~6 the database never sleeps).
- Payments are confirmed by hand. If volume grows, a payment gateway (Razorpay, Cashfree) can replace the
  UTR step without changing the rest.
