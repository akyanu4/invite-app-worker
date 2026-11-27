import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HistoryItem } from './types';

const HISTORY_KEY = 'invite.history.v2';
const DEVICE_KEY = 'invite.device';
const SHOP_TOKEN = 'invite.shopToken';
const ADMIN_TOKEN = 'invite.adminToken';

async function get(key: string) {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A random id for this phone, so the server can limit how many videos one phone makes at once. */
export async function deviceId(): Promise<string> {
  const have = await get(DEVICE_KEY);
  if (have) return have;
  const id = 'd' + Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  await AsyncStorage.setItem(DEVICE_KEY, id);
  return id;
}

export const getShopToken = () => get(SHOP_TOKEN);
export const getAdminToken = () => get(ADMIN_TOKEN);
export async function setShopToken(t: string | null) {
  if (t) await AsyncStorage.setItem(SHOP_TOKEN, t);
  else await AsyncStorage.removeItem(SHOP_TOKEN);
}
export async function setAdminToken(t: string | null) {
  if (t) await AsyncStorage.setItem(ADMIN_TOKEN, t);
  else await AsyncStorage.removeItem(ADMIN_TOKEN);
}

export async function loadHistory(): Promise<HistoryItem[]> {
  const raw = await get(HISTORY_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addHistory(item: HistoryItem): Promise<HistoryItem[]> {
  const list = (await loadHistory()).filter((h) => h.id !== item.id);
  const next = [item, ...list].slice(0, 50);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export async function removeHistory(id: string): Promise<HistoryItem[]> {
  const next = (await loadHistory()).filter((h) => h.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}
