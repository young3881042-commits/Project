import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readDailyMemos,
  removeDailyMemoById,
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
