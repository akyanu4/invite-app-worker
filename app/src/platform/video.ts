import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { VideoFile } from '../types';

export const SAVE_LABEL = 'Save';

async function download(item: VideoFile): Promise<File> {
  const file = new File(Paths.cache, `${item.id}.mp4`);
  if (file.exists && file.size > 0) return file;
  return File.downloadFileAsync(item.videoUrl, file, { idempotent: true });
}

/** Opens the phone's share sheet with the MP4 (pick WhatsApp there). */
export async function shareVideo(item: VideoFile): Promise<string | void> {
  const file = await download(item);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4', dialogTitle: 'Share invitation' });
}

/** Saves the MP4 to the gallery. Returns a message to show. */
export async function saveVideo(item: VideoFile): Promise<string> {
  const perm = await requestPermissionsAsync(true);
  if (perm.status !== 'granted') throw new Error('Allow access to save the video to your gallery.');
  const file = await download(item);
  await Asset.create(file.uri);
  return 'The video is in your gallery.';
}
