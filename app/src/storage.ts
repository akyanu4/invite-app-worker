import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HistoryItem, Settings } from './types';

// Defaults can be baked in at build time, e.g. EXPO_PUBLIC_CLOUDINARY_CLOUD=yourcloud in a .env file.
export const DEFAULT_SETTINGS: Settings = {
  cloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD ?? '',
  uploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_PRESET ?? 'invites_unsigned',
  folder: process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER ?? 'invites',
  template: 'rose_gold',
};

const SETTINGS_KEY = 'invite.settings.v1';
const HISTORY_KEY = 'invite.history.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export async function loadHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addHistory(item: HistoryItem): Promise<HistoryItem[]> {
  const list = (await loadHistory()).filter((h) => h.id !== item.id);
  const next = [item, ...list].slice(0, 30);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export async function removeHistory(id: string): Promise<HistoryItem[]> {
  const next = (await loadHistory()).filter((h) => h.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}
