export const APP_EDITOR_EXPERIENCE = 'app-edit';

export const APP_EDITOR_DEFAULT_PERMISSIONS = [
  'file:write',
  'command:execute',
  'build:execute',
  'git'
];

export const APP_EDITOR_DEFAULT_FILES = [
  '.'
];

export const APP_EDITOR_DEFAULT_COMMANDS = [
  'npm --prefix apps/web test',
  'npm --prefix apps/web run build',
  'npm --prefix tools/lifehub-bridge test',
  'npm --prefix tools/lifehub-bridge run build'
];

export function appEditorTurnDefaults(enabled) {
  if (!enabled) return { permissions: [], filesText: '', commandsText: '' };
  return {
    permissions: [...APP_EDITOR_DEFAULT_PERMISSIONS],
    filesText: APP_EDITOR_DEFAULT_FILES.join('\n'),
    commandsText: APP_EDITOR_DEFAULT_COMMANDS.join('\n')
  };
}
