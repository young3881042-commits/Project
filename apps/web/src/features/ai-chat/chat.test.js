import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationMarkdown, exportConversation } from './chatFiles.js';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { randomUUID } from 'node:crypto';
test('conversation file includes the purpose and exact Unicode messages', () => {
  const markdown = conversationMarkdown({ title: '영어 공부', purpose: '학습', messages: [{ role: 'user', text: '안녕\n두 번째 줄' }, { role: 'assistant', text: 'hello' }] });
  assert.match(markdown, /# 영어 공부/); assert.match(markdown, /목적: 학습/); assert.match(markdown, /## 나\n\n안녕\n두 번째 줄/); assert.match(markdown, /## AI\n\nhello/);
});
test('native file export waits for the matching save result and reports cancellation', async () => {
  const target = new EventTarget(); target.crypto = { randomUUID };
  target.AiAssistantNative = { exportAiConversation(id, content) {
    assert.match(content, /목적: 공부/);
    queueMicrotask(() => {
      target.dispatchEvent(new CustomEvent('orbit:chat-export', { detail: { requestId: 'other', error: 'ignored' } }));
      target.dispatchEvent(new CustomEvent('orbit:chat-export', { detail: { requestId: id, cancelled: true } }));
    });
  } };
  assert.equal(await exportConversation({ title: '대화', purpose: '공부', messages: [] }, target), false);
});
test('AI page opens directly into chat with folder tabs and tucked-away management', async () => {
  const vite = await createServer({ root: new URL('../../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { default: Page } = await vite.ssrLoadModule('/src/features/ai-chat/AiChatPage.jsx');
    const html = renderToStaticMarkup(React.createElement(Page, { owner: 'test' }));
    for (const text of ['대화 폴더', '폴더 추가', '메시지 보내기', '대화 메뉴', '공부', '업무']) assert.ok(html.includes(text));
    assert.match(html, /<textarea/);
    assert.doesNotMatch(html, /나만의 대화 보관함|대화 제목|대화 목적|대화 시작|<aside/);
    const { PRIMARY_TABS, ROUTE_META } = await vite.ssrLoadModule('/src/components/lifehub/LifeHubShell.jsx');
    assert.deepEqual(PRIMARY_TABS.slice(-2), ['travel', 'ai']); assert.equal(ROUTE_META.ai.path, '/ai');
  } finally { await vite.close(); }
});
test('Markdown export is an explicit document save with no arbitrary path or storage permission', async () => {
  const root = new URL('../../../../../', import.meta.url);
  const native = await readFile(new URL('apps/mobile/android/src/com/platform/aiassitant/AiChatExportCoordinator.java', root), 'utf8');
  assert.match(native, /ACTION_CREATE_DOCUMENT/); assert.match(native, /FLAG_GRANT_WRITE_URI_PERMISSION/);
  assert.match(native, /host\.trusted\(\)/); assert.doesNotMatch(native, /FileOutputStream|System\.out|Log\./);
});

test('saved retrieval sources render as collapsed links without expanding the simple chat screen', async () => {
  const vite = await createServer({ root: new URL('../../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom' });
  const previous = globalThis.localStorage;
  try {
    const id = randomUUID(), sourceId = randomUUID();
    const thread = { id, title: '예산 질문', purpose: '일상', messages: [{ id: randomUUID(), role: 'assistant', text: '37만원 [기억 1]', memorySources: [{ label: '기억 1', threadId: sourceId, messageId: randomUUID(), title: '<옛 예산>' }] }] };
    const values = { 'orbit-ai-chat:v1:source-test:selected': JSON.stringify(id), [`orbit-ai-chat:v1:source-test:${id}`]: JSON.stringify(thread), 'orbit-ai-chat:v1:source-test:list': JSON.stringify([thread]) };
    globalThis.localStorage = { getItem: key => values[key] ?? null };
    const { default: Page } = await vite.ssrLoadModule('/src/features/ai-chat/AiChatPage.jsx');
    const html = renderToStaticMarkup(React.createElement(Page, { owner: 'source-test' }));
    assert.match(html, /<details class="orbitChatSources"><summary>참고한 이전 대화 1개/);
    assert.match(html, /기억 1 · &lt;옛 예산&gt;/); assert.doesNotMatch(html, /<옛 예산>/);
    assert.match(html, /<textarea/);
  } finally { globalThis.localStorage = previous; await vite.close(); }
});

test('embedded mode restores only its own cached conversation and preserves the legacy cache', async () => {
  const vite = await createServer({ root: new URL('../../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom' });
  const previousStorage = globalThis.localStorage, previousWindow = globalThis.window;
  try {
    const id = randomUUID();
    const makeThread = text => ({ id, title: text, purpose: '일상', messages: [{ id: randomUUID(), role: 'user', text }] });
    const legacy = makeThread('기존 대화 보존'), embedded = makeThread('앱 내부 대화');
    const values = {};
    for (const [suffix, thread] of [['', legacy], ['embedded:', embedded]]) {
      const prefix = `orbit-ai-chat:v1:mode-test:${suffix}`;
      values[prefix + 'selected'] = JSON.stringify(id); values[prefix + id] = JSON.stringify(thread); values[prefix + 'list'] = JSON.stringify([thread]);
    }
    const snapshot = JSON.stringify(values);
    globalThis.localStorage = { getItem: key => values[key] ?? null };
    globalThis.window = { AiAssistantNative: { getAiRuntimeMode: () => 'embedded' } };
    const { default: Page } = await vite.ssrLoadModule('/src/features/ai-chat/AiChatPage.jsx');
    const html = renderToStaticMarkup(React.createElement(Page, { owner: 'mode-test' }));
    assert.match(html, /앱 내부 대화/); assert.doesNotMatch(html, /기존 대화 보존/);
    assert.equal(JSON.stringify(values), snapshot);
  } finally { globalThis.localStorage = previousStorage; globalThis.window = previousWindow; await vite.close(); }
});
