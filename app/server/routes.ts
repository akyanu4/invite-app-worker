import QRCode from 'qrcode';
import { one, q } from './db';
import {
  HttpError,
  checkPassword,
  cloudinaryUploadSignature,
  env,
  hashPassword,
  randomId,
  readToken,
  safeEqual,
  signToken,
} from './security';

const PRICE_CUSTOMER = () => Number(env('PRICE_CUSTOMER', '200'));
const PRICE_SHOP = () => Number(env('PRICE_SHOP', '50'));
const MAX_OPEN_PER_DEVICE = 5;
const STUCK_MINUTES = 20;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

async function body<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'The request was not valid JSON.');
  }
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const normPhone = (v: unknown) => str(v, 20).replace(/[^\d+]/g, '');

function publicUser(u: any) {
  return { id: u.id, phone: u.phone, name: u.name, shop_name: u.shop_name, city: u.city, status: u.status };
}

/** What the app may see about an order. The clean video link appears only after payment. */
function publicOrder(o: any) {
  const paid = o.pay_status === 'paid';
  return {
    id: o.id,
    category: o.category,
    template: o.template,
    status: o.status,
    error: o.error,
    preview_url: o.preview_url,
    final_url: paid ? o.final_url : null,
    extracted: o.extracted,
    price: o.price,
    pay_status: o.pay_status,
    pay_note: o.pay_note,
    utr: o.utr,
    promo_code: o.promo_code,
    created_at: o.created_at,
  };
}

async function currentShop(req: Request) {
  const t = readToken(req);
  if (!t || t.role !== 'shop') return null;
  return one('SELECT * FROM users WHERE id = $1', [t.sub]);
}

function requireAdmin(req: Request) {
  const t = readToken(req);
  if (!t || t.role !== 'admin') throw new HttpError(401, 'Admin sign-in required.');
}

function requireWorker(req: Request) {
  const h = req.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ') || !safeEqual(h.slice(7), env('WORKER_SECRET'))) throw new HttpError(401, 'Not the rendering PC.');
}

async function getOrder(id: string) {
  const o = await one('SELECT * FROM orders WHERE id = $1', [id]);
  if (!o) throw new HttpError(404, 'Order not found.');
  return o;
}

// ------------------------------------------------------------------------------------------ routes
export async function handle(req: Request): Promise<Response> {
  try {
    return await route(req);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong on the server. Please try again.' }, 500);
  }
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const m = req.method;
  const [a, b, c, d] = parts;

  // ---- public
  if (m === 'GET' && a === 'config') {
    return json({
      prices: { customer: PRICE_CUSTOMER(), shop: PRICE_SHOP() },
      upi: { vpa: env('UPI_VPA', ''), name: env('UPI_NAME', 'Quick Invitations') },
    });
  }
  if (m === 'GET' && a === 'catalog') {
    const row = await one('SELECT data, updated_at FROM catalog WHERE id = 1');
    return json(row ? { music: [], ...row.data, updated: row.updated_at } : { categories: [], templates: [], music: [] });
  }

  // ---- shopkeeper accounts
  if (m === 'POST' && a === 'auth' && b === 'signup') {
    const x = await body(req);
    const phone = normPhone(x.phone);
    const password = str(x.password, 100);
    const name = str(x.name, 80);
    const shop = str(x.shop_name, 120);
    if (phone.replace(/\D/g, '').length < 10) throw new HttpError(400, 'Enter a valid mobile number.');
    if (password.length < 6) throw new HttpError(400, 'Use a password of at least 6 characters.');
    if (!name || !shop) throw new HttpError(400, 'Enter your name and shop name.');
    if (await one('SELECT id FROM users WHERE phone = $1', [phone])) throw new HttpError(409, 'This number is already registered. Sign in instead.');
    const id = randomId('u');
    await q('INSERT INTO users (id, phone, name, shop_name, city, pass_hash) VALUES ($1,$2,$3,$4,$5,$6)', [
      id, phone, name, shop, str(x.city, 80), hashPassword(password),
    ]);
    const u = await one('SELECT * FROM users WHERE id = $1', [id]);
    return json({ token: signToken({ sub: id, role: 'shop' }), user: publicUser(u) });
  }
  if (m === 'POST' && a === 'auth' && b === 'login') {
    const x = await body(req);
    const u = await one('SELECT * FROM users WHERE phone = $1', [normPhone(x.phone)]);
    if (!u || !checkPassword(str(x.password, 100), u.pass_hash)) throw new HttpError(401, 'Mobile number or password is incorrect.');
    return json({ token: signToken({ sub: u.id, role: 'shop' }), user: publicUser(u) });
  }
  if (m === 'GET' && a === 'auth' && b === 'me') {
    const u = await currentShop(req);
    if (!u) throw new HttpError(401, 'Not signed in.');
    return json({ user: publicUser(u) });
  }
  if (m === 'POST' && a === 'admin' && b === 'login') {
    const x = await body(req);
    if (!safeEqual(str(x.password, 200), env('ADMIN_PASSWORD'))) throw new HttpError(401, 'Wrong admin password.');
    return json({ token: signToken({ sub: 'admin', role: 'admin' }, 14) });
  }

  // ---- card photo upload (signed by the server, so no upload preset is needed)
  if (m === 'POST' && a === 'upload' && b === 'sign') {
    const x = await body(req).catch(() => ({}) as Record<string, unknown>);
    // kind "music": a customer's own song (uploaded as a Cloudinary video/audio file)
    if (x.kind === 'music') return json(cloudinaryUploadSignature(`invites/songs/${randomId('song', 12)}`));
    return json(cloudinaryUploadSignature(`invites/cards/${randomId('card', 12)}`));
  }

  // ---- orders
  if (m === 'POST' && a === 'orders' && !b) {
    const x = await body(req);
    const device = str(x.device_id, 64);
    const category = str(x.category, 40);
    const template = str(x.template, 60);
    if (!category || !template) throw new HttpError(400, 'Choose a design first.');
    const cardUrl = str(x.card_image_url, 500);
    if (cardUrl && !/^https:\/\/res\.cloudinary\.com\//.test(cardUrl)) throw new HttpError(400, 'Card photo must be uploaded through the app.');
    const fields = typeof x.fields === 'object' && x.fields ? x.fields : {};
    const events = Array.isArray(x.events) ? x.events.slice(0, 6) : [];
    if (!cardUrl && !Object.values(fields).some((v) => typeof v === 'string' && v.trim())) {
      throw new HttpError(400, 'Fill in the details or add a card photo.');
    }
    if (device) {
      const open = await one("SELECT count(*)::int AS n FROM orders WHERE device_id = $1 AND status IN ('queued','rendering')", [device]);
      if ((open?.n ?? 0) >= MAX_OPEN_PER_DEVICE) throw new HttpError(429, 'You already have several videos being made. Wait for them to finish.');
    }
    const shop = await currentShop(req);
    const price = shop && shop.status === 'approved' ? PRICE_SHOP() : PRICE_CUSTOMER();
    const id = randomId('inv', 12);
    const ai = x.ai_quality === 'approximate' ? 'approximate' : 'accurate';
    // music: a track from the library (music_id), the customer's own upload (music_url), or the design's own
    const musicId = /^[a-z0-9_-]{1,40}$/.test(str(x.music_id, 40)) ? str(x.music_id, 40) : undefined;
    const musicUrl = str(x.music_url, 500);
    if (musicUrl && !/^https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/.*invites\/songs\//.test(musicUrl)) {
      throw new HttpError(400, 'Songs must be uploaded through the app.');
    }
    const job = {
      id, category, template, fields, events, card_image_url: cardUrl || undefined, ai_quality: ai,
      music_id: musicUrl ? undefined : musicId, music_url: musicUrl || undefined,
    };
    await q(
      'INSERT INTO orders (id, user_id, device_id, category, template, ai_quality, job, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, shop?.id ?? null, device, category, template, ai, JSON.stringify(job), price]
    );
    return json({ order: publicOrder(await getOrder(id)) });
  }
  if (m === 'GET' && a === 'orders' && b && !c) {
    const o = await getOrder(b);
    const out: Record<string, unknown> = publicOrder(o);
    if (o.status === 'queued') {
      const r = await one(
        "SELECT count(*) AS n FROM orders WHERE status IN ('queued', 'rendering') AND created_at <= $1",
        [o.created_at]
      );
      out.queue_position = Number(r?.n ?? 1);
    }
    return json({ order: out });
  }
  if (m === 'POST' && a === 'orders' && b && c === 'promo') {
    const x = await body(req);
    const o = await getOrder(b);
    if (o.pay_status === 'paid') return json({ order: publicOrder(o) });
    const code = str(x.code, 40).toUpperCase();
    const p = await one('SELECT * FROM promo_codes WHERE code = $1', [code]);
    const valid =
      p && p.active && (!p.expires_at || new Date(p.expires_at) > new Date()) && (p.max_uses == null || p.used < p.max_uses);
    if (!valid) throw new HttpError(400, 'This promo code is not valid or has expired.');
    // claim one use atomically so a limited code can't be over-used
    const claimed = await one(
      'UPDATE promo_codes SET used = used + 1 WHERE code = $1 AND (max_uses IS NULL OR used < max_uses) RETURNING discount_pct',
      [code]
    );
    if (!claimed) throw new HttpError(400, 'This promo code has been fully used.');
    const newPrice = Math.max(0, Math.round((o.price * (100 - claimed.discount_pct)) / 100));
    await q(
      "UPDATE orders SET price = $2, promo_code = $3, pay_status = CASE WHEN $2 = 0 THEN 'paid' ELSE pay_status END, pay_note = NULL, updated_at = now() WHERE id = $1",
      [b, newPrice, code]
    );
    return json({ order: publicOrder(await getOrder(b)) });
  }
  if (m === 'POST' && a === 'orders' && b && c === 'utr') {
    const x = await body(req);
    const utr = str(x.utr, 30).replace(/\s/g, '');
    if (!/^[A-Za-z0-9]{8,22}$/.test(utr)) throw new HttpError(400, 'Enter the UPI transaction ID (UTR) from your payment app, usually 12 digits.');
    const o = await getOrder(b);
    if (o.pay_status === 'paid') return json({ order: publicOrder(o) });
    const dup = await one("SELECT id FROM orders WHERE utr = $1 AND id <> $2 AND pay_status IN ('submitted','paid')", [utr, b]);
    if (dup) throw new HttpError(409, 'This transaction ID was already used for another video.');
    await q("UPDATE orders SET utr = $2, pay_status = 'submitted', pay_note = NULL, updated_at = now() WHERE id = $1", [b, utr]);
    return json({ order: publicOrder(await getOrder(b)) });
  }
  if (m === 'GET' && a === 'orders' && b && c === 'qr') {
    const o = await getOrder(b);
    const vpa = env('UPI_VPA');
    const upi = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(env('UPI_NAME', 'Quick Invitations'))}&am=${o.price}.00&cu=INR&tn=${encodeURIComponent('Invitation ' + o.id.slice(-8))}`;
    const png = await QRCode.toBuffer(upi, { width: 480, margin: 1, color: { dark: '#24191B', light: '#FFFFFF' } });
    return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } });
  }

  // ---- admin
  if (a === 'admin') {
    requireAdmin(req);
    if (m === 'GET' && b === 'summary') {
      const [payments, shops, promos, orders] = await Promise.all([
        q("SELECT * FROM orders WHERE pay_status = 'submitted' ORDER BY updated_at"),
        q("SELECT * FROM users ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 200"),
        q('SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT 200'),
        q('SELECT * FROM orders ORDER BY created_at DESC LIMIT 50'),
      ]);
      const view = (o: any) => ({ ...publicOrder({ ...o, pay_status: 'paid' }), pay_status: o.pay_status, user_id: o.user_id });
      return json({
        payments: payments.map(view),
        shops: shops.map(publicUser),
        promos,
        orders: orders.map(view),
      });
    }
    if (m === 'POST' && b === 'payments' && c) {
      const x = await body(req);
      if (x.approve) await q("UPDATE orders SET pay_status = 'paid', pay_note = NULL, updated_at = now() WHERE id = $1", [c]);
      else
        await q("UPDATE orders SET pay_status = 'rejected', pay_note = $2, updated_at = now() WHERE id = $1", [
          c,
          str(x.note, 200) || 'Payment not found. Check the transaction ID and try again.',
        ]);
      return json({ ok: true });
    }
    if (m === 'POST' && b === 'shops' && c) {
      const x = await body(req);
      await q('UPDATE users SET status = $2 WHERE id = $1', [c, x.approve ? 'approved' : 'rejected']);
      return json({ ok: true });
    }
    if (m === 'POST' && b === 'promos' && !c) {
      const x = await body(req);
      const code = str(x.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if (code.length < 3) throw new HttpError(400, 'Use at least 3 letters or numbers for the code.');
      const pct = Math.min(100, Math.max(1, Number(x.discount_pct ?? 100) || 100));
      const maxUses = x.max_uses ? Math.max(1, Number(x.max_uses)) : null;
      const expires = str(x.expires_at, 30) || null;
      await q(
        'INSERT INTO promo_codes (code, discount_pct, max_uses, expires_at, note) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO UPDATE SET discount_pct = $2, max_uses = $3, expires_at = $4, note = $5, active = true',
        [code, pct, maxUses, expires, str(x.note, 120)]
      );
      return json({ ok: true });
    }
    if (m === 'POST' && b === 'promos' && c && d === 'active') {
      const x = await body(req);
      await q('UPDATE promo_codes SET active = $2 WHERE code = $1', [c, !!x.active]);
      return json({ ok: true });
    }
  }

  // ---- rendering PC
  if (a === 'worker') {
    requireWorker(req);
    if (m === 'POST' && b === 'next') {
      // jobs stuck "rendering" (PC turned off mid-job) go back to the queue
      await q(`UPDATE orders SET status = 'queued' WHERE status = 'rendering' AND started_at < now() - interval '${STUCK_MINUTES} minutes'`);
      const o = await one(
        `UPDATE orders SET status = 'rendering', started_at = now(), updated_at = now()
         WHERE id = (SELECT id FROM orders WHERE status = 'queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
         RETURNING id, job`
      );
      return json({ job: o ? o.job : null });
    }
    if (m === 'POST' && b === 'complete') {
      const x = await body(req);
      await q(
        "UPDATE orders SET status = 'ready', preview_url = $2, final_url = $3, extracted = $4, error = NULL, updated_at = now() WHERE id = $1",
        [str(x.id, 64), str(x.preview_url, 500), str(x.final_url, 500), x.extracted ? JSON.stringify(x.extracted) : null]
      );
      return json({ ok: true });
    }
    if (m === 'POST' && b === 'fail') {
      const x = await body(req);
      await q("UPDATE orders SET status = 'failed', error = $2, updated_at = now() WHERE id = $1", [str(x.id, 64), str(x.error, 500)]);
      return json({ ok: true });
    }
    if (m === 'POST' && b === 'catalog') {
      const x = await body(req);
      await q(
        'INSERT INTO catalog (id, data, updated_at) VALUES (1, $1, now()) ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()',
        [JSON.stringify({ categories: x.categories ?? [], templates: x.templates ?? [], music: x.music ?? [] })]
      );
      return json({ ok: true });
    }
  }

  throw new HttpError(404, 'Not found.');
}
