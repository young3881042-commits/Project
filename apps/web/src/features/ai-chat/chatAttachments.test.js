import test from 'node:test';
import assert from 'node:assert/strict';
import { readChatAttachment, validateAttachments, attachmentMarkdown } from './chatAttachments.js';
const file = (name, content) => { const bytes = new TextEncoder().encode(content); return { name, size: bytes.length, arrayBuffer: async () => bytes.buffer }; };
test('text documents retain Korean and preview explicitly marks truncation', async () => {
  const result = await readChatAttachment(file('가계부.csv', '날짜,금액\r\n오늘,35000'));
  assert.equal(result.text, '날짜,금액\n오늘,35000'); assert.equal(result.truncated, false);
  const long = await readChatAttachment(file('회의.md', '가'.repeat(13000)));
  assert.equal(long.text.length, 12000); assert.equal(long.truncated, true); assert.match(attachmentMarkdown([long]), /일부 내용/);
});
test('unsupported names, binary text, oversize files and too many documents fail before sending', async () => {
  for (const item of [file('사진.png', 'abc'), file('../비밀.txt', 'abc'), file('a.txt', '\u0000binary'), { name: 'a.pdf', size: 6 * 1024 * 1024 }]) await assert.rejects(readChatAttachment(item));
  const small = await readChatAttachment(file('a.txt', 'hello'));
  assert.throws(() => validateAttachments([small, small, small, small]));
  const large = { ...small, text: 'x'.repeat(9000) };
  assert.throws(() => validateAttachments([large, large, large]), /24,000/);
});
test('PDF extraction is invoked only for validated bounded PDFs and does not silently accept empty text', async () => {
  let calls = 0;
  const parse = async () => { calls++; return { text: '계약 조건', truncated: true }; };
  await assert.rejects(readChatAttachment(file('fake.pdf', 'not a pdf'), parse)); assert.equal(calls, 0);
  const result = await readChatAttachment(file('문서.pdf', '%PDF-1.7\n'), parse);
  assert.equal(result.text, '계약 조건'); assert.equal(result.truncated, true); assert.equal(calls, 1);
  await assert.rejects(readChatAttachment(file('empty.pdf', '%PDF-1.7\n'), async () => ({ text: '', truncated: false })), /글자/);
});
