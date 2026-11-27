export type UploadPart = { part: unknown; cleanup: () => void };

/** Browser version: FormData takes a real File object. */
export async function textPart(content: string, name: string, type: string): Promise<UploadPart> {
  return { part: new File([content], name, { type }), cleanup: () => {} };
}

export async function photoPart(uri: string, name: string, type: string): Promise<UploadPart> {
  const blob = await (await fetch(uri)).blob();
  return { part: new File([blob], name, { type: blob.type || type }), cleanup: () => {} };
}
