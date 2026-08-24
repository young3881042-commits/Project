import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from 'react';
import DailyMemoIcon from './DailyMemoIcon.jsx';

function resizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 148), 360)}px`;
}

const DailyMemoComposer = forwardRef(function DailyMemoComposer({
  draft,
  draftRecoveryStatus = 'idle',
  editing = false,
  folders = [],
  quickTags,
  onCancel,
  onChange,
  onSubmit,
  onToggleTag
}, forwardedRef) {
  const bodyId = useId();
  const folderSelectId = useId();
  const shortcutHintId = useId();
  const titleId = useId();
  const formRef = useRef(null);
  const textareaRef = useRef(null);
  const hasContent = Boolean(draft.body.trim() || draft.title.trim());
  const hasMetadata = Boolean(
    draft.title.trim()
    || draft.tags.length
    || draft.customTags.trim()
    || (draft.folderId && draft.folderId !== 'personal')
  );

  useEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [draft.body]);

  useEffect(() => {
    if (editing) window.requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
  }, [editing]);

  useImperativeHandle(forwardedRef, () => ({
    scrollIntoView: (options) => formRef.current?.scrollIntoView(options),
    focusEditor: () => textareaRef.current?.focus({ preventScroll: true })
  }), []);

  const handleKeyDown = (event) => {
    if (event.isComposing) return;
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form ref={formRef} className={`dailyMemoComposer${editing ? ' isEditing' : ''}`} onSubmit={onSubmit}>
      <header className="dailyMemoComposerHeader">
        <h2>{editing ? '메모 편집' : '새 메모'}</h2>
        {editing ? (
          <button className="dailyMemoComposerCancel" type="button" onClick={onCancel}>
            <DailyMemoIcon name="close" size={18} />
            <span>수정 취소</span>
          </button>
        ) : null}
      </header>

      <section className="dailyMemoWritePanel" aria-label="메모 작성">
        <label className="dailyMemoSrOnly" htmlFor={bodyId}>메모 내용</label>
        <textarea
          id={bodyId}
          ref={textareaRef}
          value={draft.body}
          aria-describedby={shortcutHintId}
          onChange={(event) => onChange({ body: event.target.value })}
          onInput={(event) => resizeTextarea(event.currentTarget)}
          onKeyDown={handleKeyDown}
          placeholder="메모를 입력하세요…"
          rows={6}
        />
      </section>

      <details className="dailyMemoComposerDetails">
        <summary>
          <span><DailyMemoIcon name="folder" size={17} /> 폴더·제목·태그</span>
          <small>{hasMetadata ? '설정됨' : '선택'}</small>
        </summary>
        <div className="dailyMemoComposerOptional">
          <label htmlFor={titleId}>
            <span>제목</span>
            <input
              id={titleId}
              value={draft.title}
              maxLength={80}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="비워두면 첫 줄이 제목이 돼요"
            />
          </label>
          <label htmlFor={folderSelectId}>
            <span>저장 폴더</span>
            <select
              id={folderSelectId}
              value={draft.folderId || 'personal'}
              onChange={(event) => onChange({ folderId: event.target.value })}
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name || folder.title || '폴더'}</option>
              ))}
            </select>
          </label>
          <label className="dailyMemoCustomTagsField">
            <span>직접 만든 태그</span>
            <input
              value={draft.customTags}
              maxLength={180}
              onChange={(event) => onChange({ customTags: event.target.value })}
              placeholder="쉼표로 구분: 가족, 주말"
            />
          </label>
          <div className="dailyMemoComposerTags" role="group" aria-label="메모 분류">
            <span>빠른 분류</span>
            <div>
              {quickTags.map((tag) => {
                const selected = draft.tags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    className={selected ? 'isSelected' : ''}
                    aria-pressed={selected}
                    onClick={() => onToggleTag(tag)}
                  >
                    {selected ? '✓ ' : '#'}{tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </details>

      <footer className="dailyMemoComposerFooter">
        <span className={`dailyMemoDraftStatus${draftRecoveryStatus === 'error' ? ' isError' : ''}${hasContent || draftRecoveryStatus === 'error' ? '' : ' isQuiet'}`} role="status">
          <DailyMemoIcon name={draftRecoveryStatus === 'saved' ? 'check' : 'note'} size={17} />
          {draftRecoveryStatus === 'error'
            ? '임시저장 안 됨'
            : draftRecoveryStatus === 'saved'
              ? '임시 저장됨'
              : '이 기기에 임시 저장'}
        </span>
        <button className="dailyMemoSaveButton" type="submit" disabled={!hasContent}>
          <span>{editing ? '수정' : '저장'}</span>
          <DailyMemoIcon name={editing ? 'check' : 'arrowUp'} size={19} />
        </button>
      </footer>
      <span id={shortcutHintId} className="dailyMemoSrOnly">Ctrl 또는 Command와 Enter를 함께 누르면 저장합니다.</span>
    </form>
  );
});

export default DailyMemoComposer;
