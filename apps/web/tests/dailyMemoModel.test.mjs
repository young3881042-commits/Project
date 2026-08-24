import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDailyMemo,
  createDailyMemoDraft,
  dailyMemoBody,
  dailyMemoFolderId,
  dailyMemoPlainText,
  dailyMemoTags,
  dailyMemoTitle,
  readDailyMemoFolders,
  readDailyMemos,
  removeDailyMemoById,
  saveDailyMemoFolders,
  saveDailyMemos
} from '../src/components/notes/daily/dailyMemoModel.js';

class MemoryStorage {
  #items = new Map();

  clear() {
    this.#items.clear();
  }

  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }

  removeItem(key) {
    this.#items.delete(key);
  }

  setItem(key, value) {
    this.#items.set(key, String(value));
  }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
globalThis.window = { dispatchEvent() {} };

test('removeDailyMemoById removes only the selected memo and preserves order', () => {
  const first = { id: 'memo-1', title: '첫 메모' };
  const selected = { id: 'memo-2', title: '삭제할 메모' };
  const last = { id: 'memo-3', title: '마지막 메모' };
  const source = [first, selected, last];

  const result = removeDailyMemoById(source, selected.id);

  assert.equal(result.removed, true);
  assert.equal(result.removedItem, selected);
  assert.deepEqual(result.items, [first, last]);
  assert.deepEqual(source, [first, selected, last]);
});

test('removeDailyMemoById removes at most one memo when ids are duplicated', () => {
  const firstDuplicate = { id: 'duplicate', title: '첫 번째' };
  const secondDuplicate = { id: 'duplicate', title: '두 번째' };
  const untouched = { id: 'memo-3', title: '보존할 메모' };

  const result = removeDailyMemoById([firstDuplicate, secondDuplicate, untouched], 'duplicate');

  assert.equal(result.removed, true);
  assert.deepEqual(result.items, [secondDuplicate, untouched]);
  assert.equal(result.items.filter((memo) => memo.id === 'duplicate').length, 1);
});

test('removeDailyMemoById leaves every memo intact for a missing or invalid id', () => {
  const source = [{ id: 'memo-1' }, { id: 'memo-2' }];

  const missing = removeDailyMemoById(source, 'memo-404');
  const invalid = removeDailyMemoById(source, '   ');

  assert.equal(missing.removed, false);
  assert.equal(invalid.removed, false);
  assert.equal(missing.items, source);
  assert.equal(invalid.items, source);
  assert.deepEqual(source, [{ id: 'memo-1' }, { id: 'memo-2' }]);
});

test('the persisted delete flow keeps every non-target memo including BlockNote data', () => {
  localStorage.clear();
  const session = { username: 'test-user', isGuest: false };
  const richDocument = [{ id: 'block-1', type: 'paragraph', content: [{ type: 'text', text: '보존할 본문' }] }];
  const source = [
    { id: 'plain-note', title: '삭제 대상', content: '# 삭제 대상\n' },
    {
      id: 'rich-note',
      title: '보존 대상',
      content: '# 보존 대상\n\n본문',
      blockNoteDocument: richDocument,
      contentFormat: 'blocknote-v1'
    },
    { id: 'last-note', title: '마지막 메모', content: '# 마지막 메모\n' }
  ];

  assert.equal(saveDailyMemos(session, source).saved, true);
  const removal = removeDailyMemoById(readDailyMemos(session), 'plain-note');
  assert.equal(removal.removed, true);
  assert.equal(saveDailyMemos(session, removal.items).saved, true);

  const persisted = readDailyMemos(session);
  assert.equal(persisted.length, 2);
  assert.deepEqual(new Set(persisted.map((memo) => memo.id)), new Set(['rich-note', 'last-note']));
  assert.deepEqual(persisted.find((memo) => memo.id === 'rich-note').blockNoteDocument, richDocument);
});

test('이전 서식 메모도 내용 손실 없이 일반 텍스트 제목을 만든다', () => {
  const taskMemo = buildDailyMemo({
    title: '',
    body: '- [ ] 우유 사기\n- [x] 일정 확인',
    tags: []
  });
  assert.equal(dailyMemoTitle(taskMemo), '우유 사기');
  assert.equal(dailyMemoBody(taskMemo), '- [ ] 우유 사기\n- [x] 일정 확인');
  assert.equal(createDailyMemoDraft(taskMemo).body, '- [ ] 우유 사기\n- [x] 일정 확인');
  assert.equal(createDailyMemoDraft(taskMemo).title, '');

  const headingMemo = buildDailyMemo({
    title: '',
    body: '## 회의 메모\n\n- 결정 사항',
    tags: []
  });
  assert.equal(dailyMemoTitle(headingMemo), '회의 메모');
  assert.equal(dailyMemoBody(headingMemo), '- 결정 사항');
  assert.equal(dailyMemoPlainText('> **중요한** [문서](https://example.com)'), '중요한 문서');
  assert.equal(dailyMemoPlainText('my_file_v2'), 'my_file_v2');
  assert.equal(dailyMemoPlainText('_기울임_ 제목'), '기울임 제목');
});

test('제목을 자동 파생해도 첫 줄의 링크·코드 정보는 본문에 보존한다', () => {
  const linkMemo = buildDailyMemo({
    title: '',
    body: '[Orbit 문서](https://example.com/orbit)',
    tags: []
  });
  assert.equal(dailyMemoTitle(linkMemo), 'Orbit 문서');
  assert.equal(dailyMemoBody(linkMemo), '[Orbit 문서](https://example.com/orbit)');

  const codeMemo = buildDailyMemo({ title: '', body: '`npm run build`', tags: [] });
  assert.equal(dailyMemoBody(codeMemo), '`npm run build`');
});

test('이전 링크 주소와 코드 조각은 우연한 메모 태그를 만들지 않는다', () => {
  const note = {
    content: '# 링크 점검\n\n#실제태그 [문서](https://example.com/#가짜태그) `#코드태그`\n\n```\n#코드블록\n```'
  };

  assert.deepEqual(dailyMemoTags(note), ['실제태그']);
});

test('legacy notes without ids receive a stable persisted identity on first read', () => {
  localStorage.clear();
  const session = { username: 'test-user', isGuest: false };
  localStorage.setItem('codex-ai-note-blocks:test-user', JSON.stringify([
    { title: '이전 메모', content: '# 이전 메모\n\n내용' }
  ]));

  const first = readDailyMemos(session);
  const second = readDailyMemos(session);

  assert.equal(first.length, 1);
  assert.equal(first[0].id, second[0].id);
  assert.ok(first[0].createdAt);
  assert.ok(first[0].updatedAt);
});

test('메모 폴더는 기본 폴더와 사용자 폴더를 보존하고 누락된 예전 폴더를 복구한다', () => {
  localStorage.clear();
  const session = { username: 'folder-user', isGuest: false };
  const notes = [
    { id: 'memo-1', title: '업무 메모', content: '# 업무 메모\n', folderId: 'work' }
  ];
  const saved = saveDailyMemoFolders(session, [
    { id: 'personal', name: '바꾸려던 이름' },
    { id: 'ideas', name: '아이디어', parentId: 'personal' }
  ], notes);

  assert.equal(saved.saved, true);
  const folders = readDailyMemoFolders(session, notes);
  assert.deepEqual(folders.filter((folder) => ['personal', 'travel'].includes(folder.id)).map((folder) => folder.name), ['개인', '여행']);
  assert.equal(folders.find((folder) => folder.id === 'ideas').parentId, 'personal');
  assert.equal(folders.find((folder) => folder.id === 'work').name, 'work');
});

test('폴더 ID 중복·순환·전체 예약값을 복구해 사이드바 트리를 안정적으로 유지한다', () => {
  localStorage.clear();
  const session = { username: 'folder-repair', isGuest: false };
  const saved = saveDailyMemoFolders(session, [
    { id: 'all', name: '예약된 폴더' },
    { id: 'ideas', name: '아이디어', parentId: 'archive' },
    { id: 'ideas', name: '중복 아이디어' },
    { id: 'archive', name: '보관', parentId: 'ideas' }
  ]);

  assert.equal(saved.saved, true);
  assert.equal(saved.items.filter((folder) => folder.id === 'ideas').length, 1);
  assert.equal(saved.items.some((folder) => folder.id === 'all'), false);
  assert.equal(saved.items.find((folder) => folder.id === 'ideas').parentId, null);
  assert.equal(dailyMemoFolderId({ folderId: 'all' }), 'personal');
});

test('새 메모와 수정 메모는 선택한 폴더 ID를 모든 호환 필드에 저장한다', () => {
  const memo = buildDailyMemo({
    title: '폴더 테스트',
    body: '내용',
    tags: [],
    folderId: 'ideas'
  });

  assert.equal(dailyMemoFolderId(memo), 'ideas');
  assert.equal(memo.folderId, 'ideas');
  assert.equal(memo.boardId, 'ideas');
  assert.equal(memo.sector, 'ideas');
  assert.equal(createDailyMemoDraft(memo).folderId, 'ideas');
});
