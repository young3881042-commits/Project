import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAppEditorProgress, normalizeAppEditorTodos } from './appEditorProgress.js';

test('todo.updated의 text/title/description과 completed/status를 정규화한다', () => {
  const todos = normalizeAppEditorTodos({
    type: 'todo.updated',
    data: {
      items: [
        { id: 'inspect', text: '구조 확인', completed: true },
        { title: 'UI 수정', status: 'in_progress' },
        { description: '빌드 확인', status: 'done' },
        { text: '실패 항목', status: 'failed' },
        { text: '건너뜀', status: 'skipped' },
        { text: 'Boolean 우선', completed: false, status: 'completed' },
        '결과 정리',
        { status: 'pending' }
      ]
    }
  });

  assert.deepEqual(todos, [
    { id: 'inspect', text: '구조 확인', status: 'completed', completed: true },
    { id: 'todo-1', text: 'UI 수정', status: 'in-progress', completed: false },
    { id: 'todo-2', text: '빌드 확인', status: 'completed', completed: true },
    { id: 'todo-3', text: '실패 항목', status: 'failed', completed: false },
    { id: 'todo-4', text: '건너뜀', status: 'skipped', completed: false },
    { id: 'todo-5', text: 'Boolean 우선', status: 'pending', completed: false },
    { id: 'todo-6', text: '결과 정리', status: 'pending', completed: false }
  ]);
});

test('실제 todo가 있을 때만 완료 개수 기반 percent를 제공한다', () => {
  assert.equal(deriveAppEditorProgress({ streaming: true }).percent, null);

  const progress = deriveAppEditorProgress({
    streaming: true,
    todos: [
      { text: '첫 단계', completed: true },
      { text: '둘째 단계', status: 'completed' },
      { text: '셋째 단계', status: 'in-progress' }
    ]
  });

  assert.equal(progress.percent, 67);
  assert.equal(progress.totalTodoCount, 3);
  assert.equal(progress.completedTodoCount, 2);
  assert.equal(progress.phase, 'working');
  assert.equal(progress.currentActivity, '셋째 단계');
  assert.equal(progress.outcome, 'in-progress');
});

test('승인 대기를 실행 중인 일반 진행보다 우선 표시한다', () => {
  const progress = deriveAppEditorProgress({
    streaming: true,
    approvals: [{ id: 'approval-1', status: 'pending', description: '웹 UI 파일 수정' }],
    commands: [{ id: 'command-1', status: 'running', command: 'npm test' }]
  });

  assert.equal(progress.phase, 'awaiting-approval');
  assert.equal(progress.outcome, 'attention');
  assert.equal(progress.pendingApprovalCount, 1);
  assert.match(progress.currentActivity, /웹 UI 파일 수정/);
});

test('같은 명령 ID의 최신 상태를 사용해 성공·실패·실행 중 수를 계산한다', () => {
  const progress = deriveAppEditorProgress({
    streaming: true,
    commands: [
      { id: 'test', status: 'running', command: 'npm test' },
      { id: 'test', status: 'completed', command: 'npm test', exitCode: 0 },
      { id: 'build', status: 'completed', command: 'npm run build', exitCode: 1 },
      { id: 'lint', status: 'in_progress', command: 'npm run lint' }
    ]
  });

  assert.equal(progress.commandCount, 3);
  assert.equal(progress.successfulCommandCount, 1);
  assert.equal(progress.failedCommandCount, 1);
  assert.equal(progress.runningCommandCount, 1);
  assert.equal(progress.phase, 'executing');
  assert.match(progress.currentActivity, /npm run lint/);
});

test('변경 파일은 경로별로 중복을 제거하고 스트리밍 phase를 계산한다', () => {
  const progress = deriveAppEditorProgress({
    streaming: true,
    changes: [
      { id: 'first', path: 'src/App.jsx' },
      { id: 'second', path: 'src/App.jsx' },
      'src/styles.css'
    ]
  });

  assert.equal(progress.fileCount, 2);
  assert.equal(progress.phase, 'editing');
  assert.match(progress.currentActivity, /2개 파일/);
});

test('최종 응답과 명령 실패 여부로 성공·부분 성공 outcome을 구분한다', () => {
  const success = deriveAppEditorProgress({
    finalResult: '수정과 검증을 완료했습니다.',
    commands: [{ id: 'test', status: 'completed', exitCode: 0 }],
    changes: [{ path: 'src/App.jsx' }]
  });
  assert.equal(success.phase, 'completed');
  assert.equal(success.outcome, 'success');
  assert.equal(success.hasFinalResult, true);

  const partial = deriveAppEditorProgress({
    finalResult: '수정했지만 빌드가 실패했습니다.',
    commands: [{ id: 'build', status: 'completed', exitCode: 2 }]
  });
  assert.equal(partial.phase, 'completed');
  assert.equal(partial.outcome, 'partial');
  assert.equal(partial.failedCommandCount, 1);
});

test('오류는 승인·스트리밍·최종 결과보다 우선해 실패 outcome을 만든다', () => {
  const progress = deriveAppEditorProgress({
    streaming: true,
    approvals: [{ status: 'pending' }],
    finalResult: '이전 결과',
    error: new Error('Bridge 연결이 끊겼습니다.')
  });

  assert.equal(progress.phase, 'failed');
  assert.equal(progress.outcome, 'failure');
  assert.equal(progress.currentActivity, 'Bridge 연결이 끊겼습니다.');
  assert.equal(progress.error, 'Bridge 연결이 끊겼습니다.');
});

test('승인 거부와 스트리밍 종료 후 실패 명령을 terminal 실패로 계산한다', () => {
  const rejected = deriveAppEditorProgress({ approvals: [{ status: 'rejected' }] });
  assert.equal(rejected.phase, 'failed');
  assert.equal(rejected.outcome, 'failure');
  assert.equal(rejected.rejectedApprovalCount, 1);

  const commandFailed = deriveAppEditorProgress({
    commands: [{ id: 'build', status: 'failed', command: 'npm run build' }]
  });
  assert.equal(commandFailed.phase, 'failed');
  assert.equal(commandFailed.outcome, 'failure');
});
