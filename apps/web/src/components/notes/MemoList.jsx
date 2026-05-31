import { useState } from 'react';
import MemoNavIcon from '../MemoNavIcon.jsx';

export default function MemoList({
  folder,
  notes,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  getTitle,
  getExcerpt,
  getUpdatedAt,
  getTag,
  getFolderName
}) {
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState('');
  const filteredNotes = notes.filter((note) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return `${getTitle(note)} ${getExcerpt(note)}`.toLowerCase().includes(keyword);
  });

  return (
    <aside className="notesListPanel" aria-label="메모 목록">
      <header>
        <div>
          <span>현재 폴더</span>
          <strong>{getFolderName(folder)}</strong>
        </div>
        <button type="button" onClick={onCreate}><MemoNavIcon type="plus" />새 메모</button>
      </header>
      <label className="notesSearchField">
        <MemoNavIcon type="file" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="메모 검색" />
      </label>
      <div className="notesList">
        {filteredNotes.map((note) => (
          <article
            key={note.id}
            className={`notesListItem ${activeId === note.id ? 'active' : ''}`}
          >
            <button type="button" className="notesListItemMain" onClick={() => onSelect(note.id)}>
              <strong>{getTitle(note)}</strong>
              <span>{getExcerpt(note)}</span>
              <small className="notesListMetaRow">
                <time>{getUpdatedAt(note) || '방금 전'}</time>
                <em className="notesListTag">{getTag(note, folder)}</em>
              </small>
            </button>
            <div className="notesListItemActions">
              <button type="button" onClick={onCreate} aria-label="같은 폴더에 메모 추가" title="같은 폴더에 메모 추가">
                <MemoNavIcon type="plus" />
              </button>
              <div className="notesFolderMenuWrap">
                <button
                  type="button"
                  onClick={() => setOpenMenuId(openMenuId === note.id ? '' : note.id)}
                  aria-label="메모 더보기"
                  title="메모 더보기"
                >
                  ...
                </button>
                {openMenuId === note.id ? (
                  <div className="notesFolderActionMenu">
                    <button type="button" onClick={() => { onSelect(note.id); setOpenMenuId(''); }}>열기</button>
                    <button type="button" className="danger" onClick={() => { onDelete?.(note.id); setOpenMenuId(''); }}>삭제</button>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
        {filteredNotes.length ? null : (
          <div className="notesEmptyState">
            <strong>메모가 없습니다</strong>
            <span>이 폴더에 새 메모를 작성해 보세요.</span>
          </div>
        )}
      </div>
    </aside>
  );
}
