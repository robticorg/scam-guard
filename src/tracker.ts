import { store } from "./config/store";

export function track(key: string, record: AttachmentRecord): void {
  const existing = store.get(key) ?? [];
  existing.push(record);
  store.set(key, existing);
}

export function getRecords(key: string): AttachmentRecord[] {
  return store.get(key) ?? [];
}

export function prune(windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  for (const [key, records] of store) {
    const fresh = records.filter(r => r.timestamp > cutoff);
    fresh.length === 0 ? store.delete(key) : store.set(key, fresh);
  }
}
