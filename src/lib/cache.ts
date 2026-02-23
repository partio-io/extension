const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  const entry = result[key] as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    await chrome.storage.local.remove(key);
    return null;
  }
  return entry.data;
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  await chrome.storage.local.set({ [key]: entry });
}
