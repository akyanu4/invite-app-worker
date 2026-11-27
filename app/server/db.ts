// Database access. Production: Neon Postgres (DATABASE_URL). Local tests: PGlite (PGLITE_DIR).
type Row = Record<string, any>;
type Runner = (text: string, params?: unknown[]) => Promise<Row[]>;

let runner: Runner | null = null;
let migrated: Promise<void> | null = null;

async function getRunner(): Promise<Runner> {
  if (runner) return runner;
  if (process.env.PGLITE_DIR) {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite(process.env.PGLITE_DIR);
    runner = async (text, params) => (await db.query<Row>(text, params as any[])).rows;
  } else {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL is not set. Add a Neon database to the Vercel project.');
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    runner = async (text, params) => (await sql.query(text, params ?? [])) as Row[];
  }
  return runner;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     phone TEXT UNIQUE NOT NULL,
     name TEXT NOT NULL,
     shop_name TEXT NOT NULL DEFAULT '',
     city TEXT NOT NULL DEFAULT '',
     pass_hash TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS orders (
     id TEXT PRIMARY KEY,
     user_id TEXT,
     device_id TEXT NOT NULL DEFAULT '',
     category TEXT NOT NULL,
     template TEXT NOT NULL,
     ai_quality TEXT NOT NULL DEFAULT 'accurate',
     job JSONB NOT NULL,
     status TEXT NOT NULL DEFAULT 'queued',
     error TEXT,
     preview_url TEXT,
     final_url TEXT,
     extracted JSONB,
     price INTEGER NOT NULL,
     pay_status TEXT NOT NULL DEFAULT 'unpaid',
     utr TEXT,
     promo_code TEXT,
     pay_note TEXT,
     started_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status, created_at)`,
  `CREATE INDEX IF NOT EXISTS orders_pay_idx ON orders (pay_status, updated_at)`,
  `CREATE TABLE IF NOT EXISTS promo_codes (
     code TEXT PRIMARY KEY,
     discount_pct INTEGER NOT NULL DEFAULT 100,
     max_uses INTEGER,
     used INTEGER NOT NULL DEFAULT 0,
     expires_at TIMESTAMPTZ,
     active BOOLEAN NOT NULL DEFAULT true,
     note TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS catalog (
     id INTEGER PRIMARY KEY,
     data JSONB NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
];

/** Runs one statement with $1, $2 … placeholders and returns the rows. Creates the tables on first use. */
export async function q(text: string, params: unknown[] = []): Promise<Row[]> {
  const run = await getRunner();
  if (!migrated) {
    migrated = (async () => {
      for (const stmt of SCHEMA) await run(stmt);
    })();
  }
  await migrated;
  return run(text, params);
}

export async function one(text: string, params: unknown[] = []): Promise<Row | null> {
  return (await q(text, params))[0] ?? null;
}
