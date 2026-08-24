import { useEffect, useId, useRef, useState } from 'react';
import DailyMemoIcon from './DailyMemoIcon.jsx';

export default function DailyMemoCard({
  body,
  dateLabel,
  folderId = 'personal',
  folders = [],
  isRich = false,
  onDelete,
  onEdit,
  onMove,
  onPin,
  pinned = false,
  tags = [],
  title
}) {
  const editLabel = isRich ? '원본 보호 모드로 열기' : '수정하기';
  const menuId = useId();
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeFromPointer = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeFromKeyboard = (event) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeFromPointer);
    document.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeFromPointer);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [menuOpen]);

  const runAction = (action) => {
    setMenuOpen(false);
    action();
  };

  return (
    <article className={`dailyMemoCard${pinned ? ' isPinned' : ''}`}>
      <header>
        <button type="button" className="dailyMemoCardTitle" onClick={onEdit} aria-label={`${title} ${editLabel}`}>
          <strong>{title}</strong>
        </button>
        <div ref={menuRef} className="dailyMemoCardMenu">
          <button
            ref={menuButtonRef}
            type="button"
            className={menuOpen ? 'isActive' : ''}
            aria-label={`${title} 메모 작업`}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <DailyMemoIcon name="more" size={20} />
          </button>
          {menuOpen ? (
            <div id={menuId} role="group" aria-label="메모 작업">
              <button type="button" onClick={() => runAction(onEdit)}>
                <DailyMemoIcon name="edit" size={17} />
                <span>{isRich ? '원본 열기' : '편집'}</span>
              </button>
              <button type="button" onClick={() => runAction(onPin)}>
                <DailyMemoIcon name="pin" size={17} />
                <span>{pinned ? '고정 해제' : '위에 고정'}</span>
              </button>
              {onMove && folders.length ? (
                <label className="dailyMemoCardFolderSelect">
                  <DailyMemoIcon name="folder" size={17} />
                  <span className="dailyMemoSrOnly">{title} 폴더 이동</span>
                  <select
                    value={folderId}
                    aria-label={`${title} 폴더 이동`}
                    onChange={(event) => {
                      setMenuOpen(false);
                      onMove(event.target.value);
                    }}
                  >
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>{folder.name || folder.title || '폴더'}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button type="button" className="isDanger" onClick={() => runAction(onDelete)}>
                <DailyMemoIcon name="trash" size={17} />
                <span>삭제</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="dailyMemoCardBody">
        {body ? <p className="dailyMemoPlainBody isCompact">{body}</p> : <span className="isEmpty">제목만 남긴 기록이에요.</span>}
      </div>

      <footer>
        <div className="dailyMemoCardInfo">
          <span>{pinned ? '고정 · ' : ''}{isRich ? `원본 보호 · ${dateLabel}` : dateLabel}</span>
          {tags.length ? (
            <div className="dailyMemoCardTags" aria-label="태그">
              {tags.slice(0, 2).map((tag) => <span key={tag}>#{tag}</span>)}
            </div>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
