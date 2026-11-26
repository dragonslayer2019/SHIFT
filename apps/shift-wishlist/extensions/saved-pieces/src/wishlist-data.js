export const MAX_ITEMS = 100;
export const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeItems(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const items = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string') continue;
    const handle = candidate.trim();
    if (handle.length > 255 || !HANDLE_PATTERN.test(handle) || seen.has(handle)) continue;
    seen.add(handle);
    items.push(handle);
    if (items.length === MAX_ITEMS) break;
  }
  return items;
}
