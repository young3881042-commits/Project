import { useEffect, useMemo, useState } from 'react';
import { redirectToLogin } from '../../authRoutes.js';
import MemoNavIcon from '../MemoNavIcon.jsx';
import MobilePageShell from '../MobilePageShell.jsx';
import {
  READING_STATUS_OPTIONS,
  moveReadingBookStatus,
  normalizeReadingBook,
  readReadingBooks,
  readReadingSession,
  readingStorageKey,
  saveReadingBooks,
  summarizeReadingBooks
} from './readingLibrary.js';

function readingProfile(navigate) {
  const session = readReadingSession();
  const isGuest = !session || session.isGuest || session.username === 'guestuser';
  const displayName = isGuest ? 'Guest' : session.username || 'Member';
  return {
    name: displayName,
    label: isGuest ? '로그인' : '내 정보',
    onClick: () => {
      if (isGuest) {
        redirectToLogin('/reading');
        return;
      }
      navigate('/mypage');
    }
  };
}

function statusOption(status) {
  return READING_STATUS_OPTIONS.find((option) => option.id === status) || READING_STATUS_OPTIONS[0];
}

function BookRow({ book, onDelete, onMove }) {
  const option = statusOption(book.status);
  const meta = [
    book.author,
    book.startedAt ? `시작 ${book.startedAt}` : '',
    book.finishedAt ? `완독 ${book.finishedAt}` : '',
    book.memo
  ].filter(Boolean).join(' · ');

  return (
    <article className={`readingBookRow ${book.status}`}>
      <span className="readingBookBadge">{option.shortLabel}</span>
      <div className="readingBookCopy">
        <strong>{book.title}</strong>
        {meta ? <small>{meta}</small> : <small>작가 미정</small>}
      </div>
      <div className="readingBookActions">
        {READING_STATUS_OPTIONS.filter((item) => item.id !== book.status).map((item) => (
          <button type="button" key={item.id} onClick={() => onMove(book.id, item.id)}>
            {item.shortLabel}
          </button>
        ))}
        <button type="button" className="danger" onClick={() => onDelete(book.id)} aria-label={`${book.title} 삭제`}>
          <MemoNavIcon type="trash" />
        </button>
      </div>
    </article>
  );
}

export default function ReadingPage({ navigate }) {
  const session = readReadingSession();
  const storageKey = readingStorageKey(session);
  const [books, setBooks] = useState(() => readReadingBooks(session));
  const [activeStatus, setActiveStatus] = useState('interested');
  const [statusText, setStatusText] = useState('');
  const [draft, setDraft] = useState({
    title: '',
    author: '',
    status: 'interested',
    memo: ''
  });
  const counts = useMemo(() => summarizeReadingBooks(books), [books]);
  const visibleBooks = useMemo(() => books.filter((book) => book.status === activeStatus), [books, activeStatus]);
  const readingBooks = counts.reading || 0;
  const finishedBooks = counts.finished || 0;

  useEffect(() => {
    document.title = '독서';
  }, []);

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const submitBook = (event) => {
    event.preventDefault();
    const nextBook = normalizeReadingBook({
      ...draft,
      id: `book-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (!nextBook) {
      setStatusText('책 제목을 입력하세요.');
      return;
    }
    setBooks((current) => saveReadingBooks(storageKey, [nextBook, ...current]));
    setActiveStatus(nextBook.status);
    setDraft({ title: '', author: '', status: nextBook.status, memo: '' });
    setStatusText(`${nextBook.title}을 ${statusOption(nextBook.status).label}에 추가했습니다.`);
  };

  const moveBook = (bookId, nextStatus) => {
    const target = books.find((book) => book.id === bookId);
    if (!target) return;
    const movedBook = moveReadingBookStatus(target, nextStatus);
    setBooks((current) => saveReadingBooks(storageKey, current.map((book) => (book.id === bookId ? movedBook : book))));
    setActiveStatus(movedBook.status);
    setStatusText(`${movedBook.title}을 ${statusOption(movedBook.status).label}로 옮겼습니다.`);
  };

  const deleteBook = (bookId) => {
    const target = books.find((book) => book.id === bookId);
    setBooks((current) => saveReadingBooks(storageKey, current.filter((book) => book.id !== bookId)));
    setStatusText(target ? `${target.title}을 삭제했습니다.` : '책을 삭제했습니다.');
  };

  return (
    <MobilePageShell
      activeTab="more"
      className="spaceHome referenceHome utilityPageShell readingPageShell"
      icon="book"
      navigate={navigate}
      onBack={() => navigate('/more')}
      profile={readingProfile(navigate)}
      subtitle="관심 · 진행 · 완독"
      title="독서"
    >
      <section className="spaceAppFrame appHomeDashboard utilityPageDashboard readingPageDashboard" aria-label="독서">
        <section className="utilityStatsGrid readingStatsGrid" aria-label="독서 요약">
          {READING_STATUS_OPTIONS.map((option) => (
            <article className={`utilityStat readingStat ${option.id}`} key={option.id}>
              <span>{option.label}</span>
              <strong>{counts[option.id] || 0}권</strong>
            </article>
          ))}
        </section>

        <form className="utilityPageCard readingFormCard" aria-label="책 추가" onSubmit={submitBook}>
          <header className="utilitySectionHeader">
            <strong>책 추가</strong>
            <small>{readingBooks}권 진행 · {finishedBooks}권 완독</small>
          </header>
          <div className="utilityFormGrid readingFormGrid">
            <label className="utilityField full">
              <span>책 제목</span>
              <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="책 제목" />
            </label>
            <label className="utilityField">
              <span>작가</span>
              <input value={draft.author} onChange={(event) => updateDraft('author', event.target.value)} placeholder="작가" />
            </label>
            <label className="utilityField">
              <span>상태</span>
              <select value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
                {READING_STATUS_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <label className="utilityField full">
              <span>메모</span>
              <input value={draft.memo} onChange={(event) => updateDraft('memo', event.target.value)} placeholder="인상 깊은 문장, 구매처, 다음 독서 목표" />
            </label>
          </div>
          <button type="submit" className="utilityPrimaryButton">책 저장</button>
          {statusText ? <p className="utilityStatusText">{statusText}</p> : null}
        </form>

        <section className="utilityPageCard readingShelfCard" aria-label="독서 목록">
          <header className="utilitySectionHeader">
            <strong>{statusOption(activeStatus).label}</strong>
            <small>{visibleBooks.length}권</small>
          </header>
          <div className="readingStatusTabs" aria-label="독서 상태">
            {READING_STATUS_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.id}
                className={activeStatus === option.id ? 'active' : ''}
                onClick={() => setActiveStatus(option.id)}
              >
                <span>{option.shortLabel}</span>
                <strong>{counts[option.id] || 0}</strong>
              </button>
            ))}
          </div>
          <div className="readingBookList">
            {visibleBooks.map((book) => (
              <BookRow key={book.id} book={book} onDelete={deleteBook} onMove={moveBook} />
            ))}
            {visibleBooks.length ? null : <p className="utilityEmptyText">{statusOption(activeStatus).emptyText}</p>}
          </div>
        </section>
      </section>
    </MobilePageShell>
  );
}
