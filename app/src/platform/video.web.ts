import type { HistoryItem } from '../types';

export const SAVE_LABEL = 'Download';

function fileName(item: HistoryItem) {
  return `${item.title.replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-') || 'invitation'}.mp4`;
}

async function asFile(item: HistoryItem): Promise<File> {
  const blob = await (await fetch(item.videoUrl)).blob();
  return new File([blob], fileName(item), { type: 'video/mp4' });
}

/**
 * Uses the phone's share sheet (Web Share API: Android Chrome, iPhone Safari), so the MP4
 * itself goes to WhatsApp. On a computer, where file sharing isn't supported, it downloads instead.
 */
export async function shareVideo(item: HistoryItem): Promise<string | void> {
  const file = await asFile(item);
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: item.title });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') throw e; // user closed the share sheet
    }
    return;
  }
  triggerDownload(file);
  return 'This browser cannot share files directly, so the video was downloaded. Send it from WhatsApp → Attach → Document/Gallery.';
}

export async function saveVideo(item: HistoryItem): Promise<string> {
  triggerDownload(await asFile(item));
  return /iPhone|iPad/.test(navigator.userAgent)
    ? 'Downloaded to Files. To put it in Photos: Share → Save Video.'
    : 'Downloaded. You will find it in your Downloads / gallery.';
}

function triggerDownload(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
