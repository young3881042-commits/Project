import { messageWithAttachments } from '../../apps/web/src/features/ai-chat/chatAttachments.js';
// Derived, local-only search index. JSON conversations remain the source of truth.
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, writeFile, chmod, rename } from 'node:fs/promises';
import { join } from 'node:path';

const stop = new Set('내 내가 나는 나의 우리 제가 저는 저의 그 이 것 좀 다시 이전 전에 대화 기억 알려줘 알려주세요 해줘 해주세요 뭐 뭐야 무엇 어떻게 그리고 있어 있어요 주세요 the a an is are was were my me i you it that this please what how'.split(' '));
// Korean bigrams match particles/spacing variants without loading an NLP model.
export function memoryTerms(text) {
  const terms = new Set();
  for (const word of text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
    if (word.length < 2 || stop.has(word)) continue;
    terms.add(word);
    if (/^[가-힣]+$/.test(word)) for (let i = 0; i < word.length - 1; i++) {
      const term = word.slice(i, i + 2); if (!stop.has(term)) terms.add(term);
    }
  }
  return [...terms];
}
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function parseChatTurns(thread) {
  return thread.messages.flatMap((message, index) => {
    if (message.role !== 'user') return [];
    const next = thread.messages[index + 1];
    return [{ messageId: message.id, createdAt: message.createdAt || thread.createdAt,
      user: messageWithAttachments(message), assistant: next?.role === 'assistant' ? next.text : '',
      assistantId: next?.role === 'assistant' ? next.id : '' }];
  });
}
function excerpt(text, terms, size) {
  const normalized = text.toLowerCase();
  const positions = terms.map(term => normalized.indexOf(term)).filter(index => index >= 0);
  const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 100);
  return `${start ? '…' : ''}${text.slice(start, start + size)}${text.length > start + size ? '…' : ''}`;
}

export async function openChatMemory(directory) {
  const path = join(directory, 'search-v1.sqlite');
  try { const stat = await lstat(path); if (!stat.isFile()) throw Error('Invalid memory index file'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(path, '', { flag: 'wx', mode: 0o600 }); }
  await chmod(path, 0o600);
  let db;
  function open() {
    db = new DatabaseSync(path);
    db.exec(`PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=1000;
      CREATE TABLE IF NOT EXISTS threads(id TEXT PRIMARY KEY, title TEXT, purpose TEXT, revision TEXT);
      CREATE TABLE IF NOT EXISTS turns(id INTEGER PRIMARY KEY, thread_id TEXT, message_id TEXT, assistant_id TEXT,
        created_at TEXT, user_text TEXT, assistant_text TEXT, fingerprint TEXT, UNIQUE(thread_id, message_id));
      CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(tokens);
      CREATE INDEX IF NOT EXISTS thread_purpose ON threads(purpose);`);
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw Object.assign(Error('Corrupt index'), { errcode: 11 });
  }
  try { open(); } catch (error) {
    try { db?.close(); } catch { /* Already closed. */ }
    if (![11, 26].includes(error.errcode)) throw error;
    // Preserve damaged derived data privately; rebuild from validated JSON on load.
    await rename(path, `${path}.corrupt-${randomUUID()}`);
    await writeFile(path, '', { mode: 0o600, flag: 'wx' }); open();
  }
  let closed = false;
  const remove = row => { db.prepare('DELETE FROM search WHERE rowid=?').run(row.id); db.prepare('DELETE FROM turns WHERE id=?').run(row.id); };
  return {
    sync(thread) {
      const revision = hash(thread.messages.map(({ id, role, text, createdAt, attachments }) => ({ id, role, text, createdAt, ...(attachments?.length ? { attachments } : {}) })));
      const previous = db.prepare('SELECT * FROM threads WHERE id=?').get(thread.id);
      if (previous?.revision === revision && previous.title === thread.title && previous.purpose === thread.purpose) return 0;
      db.exec('BEGIN IMMEDIATE');
      let changed = 0;
      try {
        if (previous?.revision !== revision) {
          const turns = parseChatTurns(thread), ids = new Set(turns.map(turn => turn.messageId));
          for (const row of db.prepare('SELECT id,message_id FROM turns WHERE thread_id=?').all(thread.id)) if (!ids.has(row.message_id)) { remove(row); changed++; }
          for (const turn of turns) {
            const fingerprint = hash(turn);
            const old = db.prepare('SELECT id,fingerprint FROM turns WHERE thread_id=? AND message_id=?').get(thread.id, turn.messageId);
            if (old?.fingerprint === fingerprint) continue;
            if (old) remove(old);
            const result = db.prepare('INSERT INTO turns(thread_id,message_id,assistant_id,created_at,user_text,assistant_text,fingerprint) VALUES(?,?,?,?,?,?,?)')
              .run(thread.id, turn.messageId, turn.assistantId, turn.createdAt, turn.user, turn.assistant, fingerprint);
            db.prepare('INSERT INTO search(rowid,tokens) VALUES(?,?)').run(result.lastInsertRowid, memoryTerms(turn.user + '\n' + turn.assistant).join(' '));
            changed++;
          }
        }
        db.prepare('INSERT INTO threads VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,purpose=excluded.purpose,revision=excluded.revision')
          .run(thread.id, thread.title, thread.purpose, revision);
        db.exec('COMMIT'); return changed;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    reconcile(ids) {
      const keep = new Set(ids);
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const row of db.prepare('SELECT id FROM threads').all()) if (!keep.has(row.id)) {
          for (const turn of db.prepare('SELECT id FROM turns WHERE thread_id=?').all(row.id)) remove(turn);
          db.prepare('DELETE FROM threads WHERE id=?').run(row.id);
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    search(thread) {
      const terms = memoryTerms(thread.messages.at(-1)?.text || '').slice(0, 32);
      if (!terms.length) return [];
      const recent = new Set(thread.messages.slice(-20).map(message => message.id));
      // All values are bound, including the quoted FTS expression. No raw query operators.
      const rows = db.prepare(`SELECT turns.*, threads.title, threads.purpose FROM search
        JOIN turns ON turns.id=search.rowid JOIN threads ON threads.id=turns.thread_id
        WHERE search MATCH ? AND threads.purpose=? ORDER BY bm25(search), turns.created_at DESC LIMIT 48`)
        .all(terms.map(term => '"' + term + '"').join(' OR '), thread.purpose);
      return rows.filter(row => row.thread_id !== thread.id || (!recent.has(row.message_id) && !recent.has(row.assistant_id)))
        .slice(0, 4).map((row, index) => ({ label: `기억 ${index + 1}`, threadId: row.thread_id, messageId: row.message_id,
          title: row.title, purpose: row.purpose, createdAt: row.created_at,
          user: excerpt(row.user_text, terms, 700), assistant: excerpt(row.assistant_text, terms, 700) }));
    },
    close() { if (!closed) { db.close(); closed = true; } }
  };
}
