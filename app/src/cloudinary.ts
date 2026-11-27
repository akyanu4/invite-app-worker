import { photoPart, textPart } from './platform/files';
import type { Job, JobResult, Settings, TemplateInfo } from './types';

/**
 * Talks to Cloudinary exactly like test_cloudinary.py on the worker PC:
 *   1. (optional) upload the card photo        -> <folder>/cards/<id>
 *   2. upload the job JSON as a raw file       -> <folder>/jobs/pending/<id>.json
 *   3. poll for the worker's result            -> <folder>/jobs/done/<id>.result.json
 *                                                 or <folder>/jobs/failed/<id>.result.json
 * Uploads use an UNSIGNED upload preset, so no API secret is stored in the app.
 */

export function newJobId(): string {
  const rand = Array.from({ length: 10 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  return `inv-${Date.now().toString(36)}-${rand}`;
}

function checkSettings(s: Settings) {
  if (!s.cloudName || !s.uploadPreset) {
    throw new Error('Open Settings and fill in your Cloudinary cloud name and upload preset.');
  }
}

async function upload(
  s: Settings,
  resourceType: 'image' | 'raw',
  part: unknown,
  publicId: string
): Promise<{ secure_url: string; public_id: string }> {
  checkSettings(s);
  const form = new FormData();
  // Phone: { uri, name, type } object. Browser: a File object.
  form.append('file', part as Blob);
  form.append('upload_preset', s.uploadPreset);
  form.append('public_id', publicId);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Upload to Cloudinary failed: ${msg}`);
  }
  return body;
}

export async function uploadCardPhoto(s: Settings, jobId: string, localUri: string, mimeType?: string | null) {
  const type = mimeType || 'image/jpeg';
  const ext = type.includes('png') ? 'png' : type.includes('heic') ? 'heic' : 'jpg';
  const p = await photoPart(localUri, `card.${ext}`, type);
  try {
    const res = await upload(s, 'image', p.part, `${s.folder}/cards/${jobId}`);
    return res.secure_url;
  } finally {
    p.cleanup();
  }
}

export async function submitJob(s: Settings, job: Job): Promise<void> {
  const p = await textPart(JSON.stringify(job), `${job.id}.json`, 'application/json');
  try {
    await upload(s, 'raw', p.part, `${s.folder}/jobs/pending/${job.id}.json`);
  } finally {
    p.cleanup();
  }
}

async function fetchJson(url: string): Promise<JobResult | null> {
  try {
    // cache-buster so a "not found yet" answer isn't served from the CDN cache
    const res = await fetch(`${url}?cb=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;
    return (await res.json()) as JobResult;
  } catch {
    return null;
  }
}

/** Returns the result once the worker has finished, or null if it isn't ready yet. */
export async function checkResult(s: Settings, jobId: string): Promise<JobResult | null> {
  const base = `https://res.cloudinary.com/${s.cloudName}/raw/upload/${s.folder}/jobs`;
  const done = await fetchJson(`${base}/done/${jobId}.result.json`);
  if (done) return { ...done, status: done.status ?? 'done' };
  const failed = await fetchJson(`${base}/failed/${jobId}.result.json`);
  if (failed) return { ...failed, status: 'failed' };
  return null;
}

/** Quick check used by the Settings screen. */
export async function testConnection(s: Settings): Promise<string> {
  checkSettings(s);
  const id = `ping-${newJobId()}`;
  const p = await textPart('ping', `${id}.txt`, 'text/plain');
  try {
    // goes to a separate folder so the worker never sees it
    await upload(s, 'raw', p.part, `${s.folder}/ping/${id}.txt`);
    return 'Connected. Uploads to Cloudinary work.';
  } finally {
    p.cleanup();
  }
}

/**
 * The list of designs, published by the PC worker (`python worker.py publish-templates`,
 * also done automatically when the worker starts).
 */
export async function fetchTemplates(s: Settings): Promise<TemplateInfo[]> {
  const fallback: TemplateInfo[] = [{ id: s.template || 'rose_gold', title: 'Rose Gold' }];
  if (!s.cloudName) return fallback;
  try {
    const url = `https://res.cloudinary.com/${s.cloudName}/raw/upload/${s.folder}/templates/catalog.json?cb=${Date.now()}`;
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return fallback;
    const body = await res.json();
    const list: TemplateInfo[] = Array.isArray(body?.templates) ? body.templates : [];
    return list.length ? list : fallback;
  } catch {
    return fallback;
  }
}
