import { Platform } from 'react-native';
import bundled from './categories.json';
import { photoPart } from './platform/files';
import { getAdminToken, getShopToken } from './storage';
import type { AiQuality, AppConfig, Catalog, Category, Fields, InviteEvent, Order, Promo, ShopUser } from './types';

/**
 * The app's server (Vercel). On the website it is the same address; the phone app needs
 * EXPO_PUBLIC_API_URL=https://<your-site>.vercel.app at build time.
 */
export const API_URL = Platform.OS === 'web' ? '' : (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/** Occasion forms shipped with the app, used until the server's list arrives. */
export const BUNDLED_CATEGORIES = (bundled as unknown as { categories: Category[] }).categories;

async function call<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error('No internet connection. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `The server answered ${res.status}. Please try again.`);
  return data as T;
}

// ---------------------------------------------------------------- public
export const getConfig = () => call<AppConfig>('/api/config');

export async function getCatalog(): Promise<Catalog> {
  try {
    const c = await call<Catalog>(`/api/catalog?cb=${Date.now()}`);
    return { categories: c.categories?.length ? c.categories : BUNDLED_CATEGORIES, templates: c.templates ?? [] };
  } catch {
    return { categories: BUNDLED_CATEGORIES, templates: [] };
  }
}

// ---------------------------------------------------------------- shopkeeper accounts
export type AuthResult = { token: string; user: ShopUser };
export const signUp = (x: { phone: string; password: string; name: string; shop_name: string; city: string }) =>
  call<AuthResult>('/api/auth/signup', { body: x });
export const signIn = (phone: string, password: string) => call<AuthResult>('/api/auth/login', { body: { phone, password } });
export async function getMe(): Promise<ShopUser | null> {
  const token = await getShopToken();
  if (!token) return null;
  return (await call<{ user: ShopUser }>('/api/auth/me', { token })).user;
}

// ---------------------------------------------------------------- orders
/** Uploads the card photo with a one-time signature from the server (no Cloudinary keys in the app). */
export async function uploadCard(uri: string, mimeType?: string | null): Promise<string> {
  const sig = await call<{ cloud_name: string; api_key: string; timestamp: number; public_id: string; signature: string }>(
    '/api/upload/sign',
    { body: {} }
  );
  const type = mimeType || 'image/jpeg';
  const p = await photoPart(uri, type.includes('png') ? 'card.png' : 'card.jpg', type);
  try {
    const form = new FormData();
    form.append('file', p.part as Blob);
    form.append('api_key', sig.api_key);
    form.append('timestamp', String(sig.timestamp));
    form.append('public_id', sig.public_id);
    form.append('signature', sig.signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`The card photo could not be uploaded: ${body?.error?.message ?? res.status}`);
    return body.secure_url as string;
  } finally {
    p.cleanup();
  }
}

export async function createOrder(x: {
  device_id: string;
  category: string;
  template: string;
  fields?: Fields;
  events?: InviteEvent[];
  card_image_url?: string;
  ai_quality?: AiQuality;
}): Promise<Order> {
  return (await call<{ order: Order }>('/api/orders', { body: x, token: await getShopToken() })).order;
}

export const getOrder = async (id: string) => (await call<{ order: Order }>(`/api/orders/${id}`)).order;
export const applyPromo = async (id: string, code: string) =>
  (await call<{ order: Order }>(`/api/orders/${id}/promo`, { body: { code } })).order;
export const submitUtr = async (id: string, utr: string) =>
  (await call<{ order: Order }>(`/api/orders/${id}/utr`, { body: { utr } })).order;
export const qrImageUrl = (id: string) => `${API_URL}/api/orders/${id}/qr`;

export function upiLink(cfg: AppConfig, order: Order) {
  const q = `pa=${encodeURIComponent(cfg.upi.vpa)}&pn=${encodeURIComponent(cfg.upi.name)}&am=${order.price}.00&cu=INR&tn=${encodeURIComponent(
    'Invitation ' + order.id.slice(-8)
  )}`;
  return `upi://pay?${q}`;
}

// ---------------------------------------------------------------- admin
export const adminSignIn = (password: string) => call<{ token: string }>('/api/admin/login', { body: { password } });

export type AdminSummary = { payments: Order[]; shops: ShopUser[]; promos: Promo[]; orders: Order[] };
export const adminSummary = async () => call<AdminSummary>('/api/admin/summary', { token: await getAdminToken() });
export const adminPayment = async (id: string, approve: boolean, note?: string) =>
  call(`/api/admin/payments/${id}`, { body: { approve, note }, token: await getAdminToken() });
export const adminShop = async (id: string, approve: boolean) =>
  call(`/api/admin/shops/${id}`, { body: { approve }, token: await getAdminToken() });
export const adminSavePromo = async (x: { code: string; discount_pct: number; max_uses?: number | null; expires_at?: string; note?: string }) =>
  call('/api/admin/promos', { body: x, token: await getAdminToken() });
export const adminPromoActive = async (code: string, active: boolean) =>
  call(`/api/admin/promos/${encodeURIComponent(code)}/active`, { body: { active }, token: await getAdminToken() });
