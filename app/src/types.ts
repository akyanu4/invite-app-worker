export type Fields = Record<string, string>;
export type InviteEvent = Record<string, string>;

export type FieldDef = { key: string; label: string; hint?: string; caps?: boolean };
export type Section = { title: string; fields: FieldDef[] };

/** An occasion (Marriage, Birthday, ...): its form and sample details. Published by the worker. */
export type Category = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  sections: Section[];
  events: { title: string; help?: string; fields: FieldDef[] };
  defaults?: Fields;
  title_fields?: string[];
  sample?: { fields: Fields; events: InviteEvent[] };
};

export type TemplateInfo = {
  id: string;
  title: string;
  category?: string;
  tags?: string[];
  order?: number;
  description?: string;
  preview_url?: string;
  preview_video_url?: string;
};

export type Catalog = { categories: Category[]; templates: TemplateInfo[] };

export type AiQuality = 'accurate' | 'approximate';

export type PayStatus = 'unpaid' | 'submitted' | 'paid' | 'rejected';

export type Order = {
  id: string;
  category: string;
  template: string;
  status: 'queued' | 'rendering' | 'ready' | 'failed';
  error?: string | null;
  preview_url?: string | null;
  final_url?: string | null;
  extracted?: { fields?: Fields; events?: InviteEvent[] } | null;
  price: number;
  pay_status: PayStatus;
  pay_note?: string | null;
  utr?: string | null;
  promo_code?: string | null;
  created_at: string;
  user_id?: string | null;
  /** Place in the queue while waiting (1 = next). */
  queue_position?: number;
};

export type ShopUser = {
  id: string;
  phone: string;
  name: string;
  shop_name: string;
  city?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
};

export type Promo = {
  code: string;
  discount_pct: number;
  max_uses: number | null;
  used: number;
  expires_at: string | null;
  active: boolean;
  note?: string | null;
};

export type AppConfig = { prices: { customer: number; shop: number }; upi: { vpa: string; name: string } };

/** One video in "Your videos" (kept on this phone; payment state is read from the server). */
export type HistoryItem = {
  id: string; // order id
  category: string;
  template?: string;
  title: string;
  createdAt: number;
  fields: Fields;
  events: InviteEvent[];
  fromCard?: boolean;
};

/** What the share/save helpers need. */
export type VideoFile = { id: string; title: string; videoUrl: string };
