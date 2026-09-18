// Shared by manual UI and assistant execution. Keep normalization and owner selection with the caller.
export function persistSchedules(items, { normalize, compare, write, read, onSaved }) {
  const normalized = items.map(normalize).filter(Boolean).sort(compare);
  if (!write(normalized)) return { items: normalized, saved: false };
  const saved = JSON.stringify(read()) === JSON.stringify(normalized);
  if (saved) onSaved(normalized);
  return { items: normalized, saved };
}
