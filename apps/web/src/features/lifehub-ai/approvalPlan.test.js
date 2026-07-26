import test from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalPlan, unsafeProjectRelativePath } from './approvalPlan.js';

test('수정/명령 turn은 명시한 승인 범위만 정규화한다', () => {
  const plan = createApprovalPlan({
    requestedPermissions: ['project:read', 'file:write', 'command:execute'],
    filesText: 'src/App.jsx\nsrc/App.jsx\nsrc/styles.css',
    commandsText: 'npm test\nnpm run build',
    description: 'UI 수정'
  });
  assert.equal(plan.error, '');
  assert.deepEqual(plan.context, {
    description: 'UI 수정',
    files: ['src/App.jsx', 'src/styles.css'],
    commands: ['npm test', 'npm run build']
  });
});

test('프로젝트 외부/절대 파일 경로와 빈 명령 범위를 거부한다', () => {
  assert.equal(unsafeProjectRelativePath('../secret'), true);
  assert.equal(unsafeProjectRelativePath('/etc/passwd'), true);
  assert.equal(unsafeProjectRelativePath('C:\\secret.txt'), true);
  assert.match(createApprovalPlan({ requestedPermissions: ['file:write'], filesText: '../secret' }).error, /상대 경로/);
  assert.match(createApprovalPlan({ requestedPermissions: ['build:execute'], commandsText: '' }).error, /실행 예정 명령/);
});

test('읽기 전용 turn은 approvalContext를 만들지 않는다', () => {
  const plan = createApprovalPlan({ requestedPermissions: ['project:read'], filesText: '', commandsText: '' });
  assert.equal(plan.error, '');
  assert.equal(plan.context, undefined);
});
