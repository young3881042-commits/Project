import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_EDITOR_DEFAULT_COMMANDS,
  APP_EDITOR_DEFAULT_FILES,
  appEditorTurnDefaults
} from './appEditorExperience.js';

test('앱 수정 모드는 선택 프로젝트 전체와 네 작업 권한·기본 검증 명령을 미리 채운다', () => {
  const defaults = appEditorTurnDefaults(true);

  assert.deepEqual(defaults.permissions, ['file:write', 'command:execute', 'build:execute', 'git']);
  assert.equal(defaults.filesText, '.');
  for (const command of ['npm --prefix apps/web test', 'npm --prefix apps/web run build']) {
    assert.ok(defaults.commandsText.split('\n').includes(command));
  }
  assert.notEqual(defaults.permissions, appEditorTurnDefaults(true).permissions);
});

test('일반 AI 모드는 수정 권한과 승인 범위를 자동 선택하지 않는다', () => {
  assert.deepEqual(appEditorTurnDefaults(false), {
    permissions: [],
    filesText: '',
    commandsText: ''
  });
  assert.ok(APP_EDITOR_DEFAULT_FILES.length > 0);
  assert.ok(APP_EDITOR_DEFAULT_COMMANDS.length > 0);
});
