export const DEFAULT_NOTE_DIRECTORIES = [
  { id: 'personal', name: '개인', title: '개인', sortOrder: 0 },
  { id: 'travel', name: '여행', title: '여행', sortOrder: 1 }
];

export const DEFAULT_NOTE_DIRECTORY_ID_SET = new Set(DEFAULT_NOTE_DIRECTORIES.map((directory) => directory.id));

export function createDefaultNoteDirectories(timestamp) {
  return DEFAULT_NOTE_DIRECTORIES.map((directory) => ({
    ...directory,
    parentId: null,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
}

export function normalizeNoteDirectoryId(value, planType = '') {
  const raw = `${value || ''}`.trim();
  const normalizedRaw = raw.toLowerCase();
  const normalizedPlanType = `${planType || ''}`.toLowerCase();
  if (raw && !['memo', 'project', 'personal', 'general', 'travel'].includes(normalizedRaw) && !raw.startsWith('travel-plan-board-') && !normalizedRaw.startsWith('travel-')) {
    return raw;
  }
  const text = `${normalizedRaw} ${normalizedPlanType}`;
  if (raw === 'travel' || raw.startsWith('travel-plan-board-') || normalizedRaw.startsWith('travel-') || text.includes('travel') || text.includes('trip') || text.includes('여행')) {
    return 'travel';
  }
  if (!raw || raw === 'memo' || raw === 'project' || raw === 'personal' || text.includes('personal') || text.includes('개인')) {
    return 'personal';
  }
  return raw;
}
