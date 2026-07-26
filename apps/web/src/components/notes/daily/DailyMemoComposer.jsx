import { forwardRef, useEffect, useId, useRef } from 'react';
import DailyMemoIcon from './DailyMemoIcon.jsx';

function resizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 132), 320)}px`;
}

const DailyMemoComposer = forwardRef(function DailyMemoComposer({
  draft,
  editing = false,
  quickTags,
  onCancel,
  onChange,
  onSubmit,
  onToggleTag
}, forwardedRef) {
  const bodyId = useId();
  const titleId = useId();
  const textareaRef = useRef(null);
  const hasContent = Boolean(draft.body.trim() || draft.title.trim());

  useEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [draft.body]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus({ preventScroll: true });
  }, [editing]);

  const handleKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form ref={forwardedRef} className={`dailyMemoComposer${editing ? ' isEditing' : ''}`} onSubmit={onSubmit}>
      <header className="dailyMemoComposerHeader">
        <div>
          <span className="dailyMemoEyebrow">
            <DailyMemoIcon name={editing ? 'edit' : 'spark'} size={16} />
            {editing ? '기록 다듬기' : '오늘의 한 줄'}
          </span>
          <h2>{editing ? '기억을 조금 더 선명하게' : '지금 떠오른 것을 적어보세요'}</h2>
        </div>
        {editing ? (
          <button className="dailyMemoComposerCancel" type="button" onClick={onCancel}>
            <DailyMemoIcon name="close" size={18} />
            <span>수정 취소</span>
          </button>
        ) : null}
      </header>

      <label className="dailyMemoSrOnly" htmlFor={bodyId}>메모 내용</label>
      <textarea
        id={bodyId}
        ref={textareaRef}
        value={draft.body}
        onChange={(event) => onChange({ body: event.target.value })}
        onInput={(event) => resizeTextarea(event.currentTarget)}
        onKeyDown={handleKeyDown}
        placeholder="예: 퇴근길에 본 노을이 참 예뻤다."
        rows={4}
      />

      <div className="dailyMemoComposerTags" role="group" aria-label="메모 분류">
          <span>어떤 기록인가요? · 여러 개 선택 가능</span>
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
                <span aria-hidden="true">{selected ? '✓' : '#'}</span>
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <details className="dailyMemoComposerDetails">
        <summary>
          <span><DailyMemoIcon name="tag" size={17} /> 제목·태그 더하기</span>
          <small>선택 사항</small>
        </summary>
        <div className="dailyMemoComposerOptional">
          <label htmlFor={titleId}>
            <span>제목</span>
            <input
              id={titleId}
              value={draft.title}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="비워두면 첫 줄이 제목이 돼요"
            />
          </label>
          <label>
            <span>직접 만든 태그</span>
            <input
              value={draft.customTags}
              onChange={(event) => onChange({ customTags: event.target.value })}
              placeholder="쉼표로 구분: 가족, 주말"
            />
          </label>
        </div>
      </details>

      <footer className="dailyMemoComposerFooter">
        <span className="dailyMemoDraftStatus">
          <DailyMemoIcon name={hasContent ? 'check' : 'note'} size={17} />
          {editing
            ? '수정 중인 내용도 임시 보관돼요'
            : hasContent ? '작성 중인 내용은 임시 보관돼요' : '한 줄만 적어도 충분해요'}
        </span>
        <button className="dailyMemoSaveButton" type="submit" disabled={!hasContent}>
          <span>{editing ? '수정 저장' : '기록 남기기'}</span>
          <DailyMemoIcon name={editing ? 'check' : 'arrowUp'} size={19} />
        </button>
      </footer>
      <span className="dailyMemoKeyboardHint">Ctrl 또는 ⌘ + Enter로 빠르게 저장</span>
    </form>
  );
});

export default DailyMemoComposer;
