// Local test server: runs the same API handler on http://localhost:8787 (and serves dist/ for the app).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { handle } from './routes';

const DIST = process.env.DIST_DIR || join(__dirname, '..', 'dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.css': 'text/css' };

createServer(async (req, res) => {
  const url = `http://localhost${req.url}`;
  if (req.url?.startsWith('/api')) {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const r = await handle(new Request(url, { method: req.method, headers: req.headers as any, body: chunks.length ? Buffer.concat(chunks) : undefined }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  const path = new URL(url).pathname;
  const file = join(DIST, path === '/' ? 'index.html' : path);
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(await readFile(join(DIST, 'index.html')));
  }
}).listen(Number(process.env.PORT || 8787), () => console.log('dev server on', process.env.PORT || 8787));
