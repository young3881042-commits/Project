import DailyMemoIcon from './DailyMemoIcon.jsx';

const TAG_ACCENTS = {
  '감사': 'sun',
  '기억': 'rose',
  '아이디어': 'lavender',
  '할 일': 'mint'
};

export default function DailyMemoCard({
  body,
  dateLabel,
  isRich = false,
  onDelete,
  onEdit,
  onPin,
  pinned = false,
  tags = [],
  title
}) {
  const accent = TAG_ACCENTS[tags[0]] || (pinned ? 'rose' : 'paper');
  const editLabel = isRich ? '고급 편집기로 열기' : '수정하기';

  return (
    <article className={`dailyMemoCard${pinned ? ' isPinned' : ''}`} data-accent={accent}>
      <header>
        <span className="dailyMemoCardMeta">
          {pinned ? <><DailyMemoIcon name="pin" size={15} /> 중요 기록</> : dateLabel}
        </span>
        <button
          type="button"
          className={`dailyMemoCardPin${pinned ? ' isActive' : ''}`}
          aria-label={pinned ? `${title} 고정 해제` : `${title} 중요 기록으로 고정`}
          aria-pressed={pinned}
          onClick={onPin}
          title={pinned ? '고정 해제' : '고정'}
        >
          <DailyMemoIcon name="pin" size={18} />
        </button>
      </header>

      <button type="button" className="dailyMemoCardBody" onClick={onEdit} aria-label={`${title} ${editLabel}`}>
        <strong>{title}</strong>
        {body ? <span>{body}</span> : <span className="isEmpty">제목만 남긴 기록이에요.</span>}
      </button>

      {tags.length ? (
        <div className="dailyMemoCardTags" aria-label="태그">
          {tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
      ) : null}

      <footer>
        <span>{pinned ? dateLabel : isRich ? '자세히 편집하는 메모' : '간편 메모'}</span>
        <div>
          <button type="button" onClick={onEdit} aria-label={`${title} ${editLabel}`} title={editLabel}>
            <DailyMemoIcon name="edit" size={18} />
          </button>
          <button type="button" className="isDanger" onClick={onDelete} aria-label={`${title} 삭제`} title="삭제">
            <DailyMemoIcon name="trash" size={18} />
          </button>
        </div>
      </footer>
    </article>
  );
}
