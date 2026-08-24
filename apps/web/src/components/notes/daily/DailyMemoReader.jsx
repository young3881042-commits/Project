import { useEffect, useId, useRef } from 'react';
import DailyMemoIcon from './DailyMemoIcon.jsx';

const FOCUSABLE = 'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])';

export default function DailyMemoReader({ body, dateLabel, onClose, onCopy, tags = [], title }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div
      className="dailyMemoReaderBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="dailyMemoReader"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header>
          <div>
            <span id={descriptionId}>이전 서식 메모 · 원본 보호 모드</span>
            <h2 id={titleId}>{title}</h2>
            <small>{dateLabel}</small>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="메모 닫기" title="닫기">
            <DailyMemoIcon name="close" size={20} />
          </button>
        </header>

        {tags.length ? (
          <div className="dailyMemoReaderTags" aria-label="태그">
            {tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </div>
        ) : null}

        <article className="dailyMemoReaderBody">
          {body ? (
            <p className="dailyMemoPlainBody">{body}</p>
          ) : (
            <div className="dailyMemoReaderUnavailable">
              <DailyMemoIcon name="note" size={28} />
              <strong>이 메모의 원문 서식은 그대로 보존되어 있어요</strong>
              <p>현재 간편 메모 화면에서 안전하게 변환할 수 있는 텍스트 본문이 없습니다.</p>
            </div>
          )}
        </article>

        <footer>
          {body ? (
            <button type="button" className="isSecondary" onClick={onCopy}>
              텍스트 사본으로 편집
            </button>
          ) : null}
          <button type="button" className="isPrimary" onClick={onClose}>닫기</button>
        </footer>
      </section>
    </div>
  );
}
