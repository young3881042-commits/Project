import { useMemo, useRef } from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { useCreateBlockNote } from '@blocknote/react';

function normalizeLegacyBlock(block, index = 0) {
  const type = ['heading', 'paragraph', 'bullet', 'checklist', 'code', 'divider'].includes(block?.type)
    ? block.type
    : 'paragraph';
  return {
    id: block?.id || `memo-block-${index}`,
    type,
    text: typeof block?.text === 'string' ? block.text : '',
    checked: Boolean(block?.checked),
    level: Math.max(1, Math.min(3, Number(block?.level) || 1))
  };
}

function plainTextFromInlineContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((item) => {
    if (typeof item === 'string') return item;
    if (item?.type === 'text') return item.text || '';
    if (item?.type === 'link') return plainTextFromInlineContent(item.content);
    return item?.text || '';
  }).join('');
}

function legacyBlockToBlockNote(block, index) {
  const normalized = normalizeLegacyBlock(block, index);
  if (normalized.type === 'heading') {
    return {
      id: normalized.id,
      type: 'heading',
      props: { level: normalized.level },
      content: normalized.text || '제목'
    };
  }
  if (normalized.type === 'bullet') {
    return {
      id: normalized.id,
      type: 'bulletListItem',
      content: normalized.text || '목록'
    };
  }
  if (normalized.type === 'checklist') {
    return {
      id: normalized.id,
      type: 'checkListItem',
      props: { checked: normalized.checked },
      content: normalized.text || '체크리스트'
    };
  }
  if (normalized.type === 'code') {
    return {
      id: normalized.id,
      type: 'codeBlock',
      props: { language: 'text' },
      content: normalized.text || ''
    };
  }
  if (normalized.type === 'divider') {
    return {
      id: normalized.id,
      type: 'paragraph',
      content: '---'
    };
  }
  return {
    id: normalized.id,
    type: 'paragraph',
    content: normalized.text || ''
  };
}

function normalizeBlockNoteDocument(document, legacyBlocks) {
  if (Array.isArray(document) && document.length) {
    return document;
  }
  const blocks = Array.isArray(legacyBlocks) && legacyBlocks.length ? legacyBlocks : [{ type: 'paragraph', text: '' }];
  return blocks.map(legacyBlockToBlockNote);
}

function blockNoteBlockToLegacy(block, index) {
  const text = plainTextFromInlineContent(block?.content);
  const base = {
    id: block?.id || `memo-block-${index}`,
    text,
    checked: false,
    level: 1
  };
  if (block?.type === 'heading') {
    return { ...base, type: 'heading', level: Math.max(1, Math.min(3, Number(block.props?.level) || 1)) };
  }
  if (block?.type === 'bulletListItem' || block?.type === 'numberedListItem' || block?.type === 'toggleListItem') {
    return { ...base, type: 'bullet' };
  }
  if (block?.type === 'checkListItem') {
    return { ...base, type: 'checklist', checked: Boolean(block.props?.checked) };
  }
  if (block?.type === 'codeBlock') {
    return { ...base, type: 'code' };
  }
  if (text.trim() === '---') {
    return { ...base, type: 'divider', text: '' };
  }
  return { ...base, type: 'paragraph' };
}

function blockNoteDocumentToLegacy(document) {
  const blocks = Array.isArray(document) ? document : [];
  const legacyBlocks = blocks.map(blockNoteBlockToLegacy).filter((block) => block.type !== 'paragraph' || block.text.trim());
  return legacyBlocks.length ? legacyBlocks : [{ id: 'memo-block-empty', type: 'paragraph', text: '', checked: false, level: 1 }];
}

export default function BlockNoteMemoEditor({ blocks, blockNoteDocument, onChange }) {
  const initialContent = useMemo(() => normalizeBlockNoteDocument(blockNoteDocument, blocks), [blockNoteDocument, blocks]);
  const lastSerializedRef = useRef(JSON.stringify(initialContent));
  const editor = useCreateBlockNote({ initialContent });

  const handleChange = (nextEditor) => {
    const document = nextEditor.document;
    const serialized = JSON.stringify(document);
    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;
    onChange(blockNoteDocumentToLegacy(document), document);
  };

  return (
    <div className="blockNoteMemoEditor">
      <BlockNoteView
        editor={editor}
        theme="light"
        onChange={handleChange}
        sideMenu
        slashMenu
        formattingToolbar
        linkToolbar
      />
    </div>
  );
}
