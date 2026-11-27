import { File, Paths } from 'expo-file-system';

export type UploadPart = { part: unknown; cleanup: () => void };

/** A text file ready to append to FormData (phone version: written to the cache folder). */
export async function textPart(content: string, name: string, type: string): Promise<UploadPart> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.writeSync(content);
  return {
    part: { uri: file.uri, name, type },
    cleanup: () => {
      if (file.exists) file.delete();
    },
  };
}

/** A picked photo ready to append to FormData. */
export async function photoPart(uri: string, name: string, type: string): Promise<UploadPart> {
  return { part: { uri, name, type }, cleanup: () => {} };
}
