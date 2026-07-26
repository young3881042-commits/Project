import { useEffect, useMemo, useRef, useState } from 'react';
import { FeedbackToast, useLifeHubFeedback } from '../../lifehub/LifeHubUi.jsx';
import DailyMemoCard from './DailyMemoCard.jsx';
import DailyMemoComposer from './DailyMemoComposer.jsx';
import DailyMemoIcon, { DailyMemoMark } from './DailyMemoIcon.jsx';
import {
  DAILY_MEMO_ALL_TAG,
  DAILY_MEMO_QUICK_TAGS,
  buildDailyMemo,
  clearDailyMemoDraft,
  createDailyMemoDraft,
  dailyMemoBody,
  dailyMemoRhythm,
  dailyMemoSearch,
  dailyMemoTags,
  dailyMemoTitle,
  ensureDailyMemoBoards,
  formatDailyMemoTime,
  isRichDailyMemo,
  readDailyMemoDraft,
  readDailyMemos,
  removeDailyMemoById,
  saveDailyMemoDraft,
  saveDailyMemos
} from './dailyMemoModel.js';

const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
});
const MEMO_EDITOR_HISTORY_KEY = 'lifehubMemoEditor';

function paramsForPath(path) {
  const raw = String(path || window.location.search || '');
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw.replace(/^\?/, '');
  return new URLSearchParams(query);
}

function replaceMemoPath(nextPath) {
  if (window.location.pathname + window.location.search === nextPath) return;
  window.history.replaceState({}, '', nextPath);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function currentMemoHistoryState() {
  return window.history.state && typeof window.history.state === 'object'
    ? window.history.state
    : {};
}

function ensureMemoEditorHistory() {
  const current = window.location.pathname + window.location.search;
  const state = currentMemoHistoryState();
  if (window.location.pathname !== '/memo' || state[MEMO_EDITOR_HISTORY_KEY] === true) return;
  const baseState = { ...state };
  delete baseState[MEMO_EDITOR_HISTORY_KEY];
  window.history.replaceState(baseState, '', '/memo');
  window.history.pushState({ ...baseState, [MEMO_EDITOR_HISTORY_KEY]: true }, '', current);
}

function pushMemoEditorPath(nextPath) {
  const current = window.location.pathname + window.location.search;
  const state = currentMemoHistoryState();
  if (current === nextPath) {
    ensureMemoEditorHistory();
    return;
  }
  if (state[MEMO_EDITOR_HISTORY_KEY] === true && window.location.pathname === '/memo') {
    window.history.replaceState(state, '', nextPath);
  } else {
    window.history.pushState({ ...state, [MEMO_EDITOR_HISTORY_KEY]: true }, '', nextPath);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function closeMemoEditorPath() {
  if (currentMemoHistoryState()[MEMO_EDITOR_HISTORY_KEY] === true) {
    window.history.back();
    return;
  }
  replaceMemoPath('/memo');
}

function uiDraft(note = null, recovered = null) {
  let source = recovered && typeof recovered === 'object'
    ? { ...createDailyMemoDraft(), ...recovered }
    : createDailyMemoDraft(note);
  if (note?.titleDerived && !recovered) {
    source = {
      ...source,
      title: '',
      body: [dailyMemoTitle(note), dailyMemoBody(note)].filter(Boolean).join('\n')
    };
  }
  const tags = Array.isArray(source.tags) ? source.tags : [];
  const quickTags = tags.filter((tag) => DAILY_MEMO_QUICK_TAGS.includes(tag));
  const customTags = typeof source.customTags === 'string'
    ? source.customTags
    : tags.filter((tag) => !DAILY_MEMO_QUICK_TAGS.includes(tag)).join(', ');
  return {
    title: String(source.title || ''),
    body: String(source.body || ''),
    tags: quickTags,
    customTags
  };
}

function tagsForSave(draft) {
  const custom = String(draft.customTags || '')
    .split(',')
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter(Boolean);
  return [...new Set([...(draft.tags || []), ...custom])].slice(0, 6);
}

function hasDraftContent(draft) {
  return Boolean(draft.body.trim() || draft.title.trim() || draft.customTags.trim() || draft.tags.length);
}

function greetingForHour(hour) {
  if (hour < 6) return '고요한 밤이에요';
  if (hour < 12) return '좋은 아침이에요';
  if (hour < 18) return '오늘도 잘 보내고 있나요?';
  return '오늘 하루도 수고했어요';
}

function richEditorPath(note) {
  const params = new URLSearchParams({
    board: note.folderId || note.boardId || 'personal',
    block: note.id
  });
  return `/notes?${params.toString()}`;
}

function requiresFullEditor(note) {
  return Boolean(isRichDailyMemo(note) || note?.schedule?.enabled || note?.scheduleEnabled);
}

function DailyMemoEmpty({ filtered, onReset, onWrite }) {
  return (
    <div className="dailyMemoEmpty">
      <span><DailyMemoIcon name={filtered ? 'search' : 'leaf'} size={27} /></span>
      <strong>{filtered ? '조건에 맞는 기록이 없어요' : '첫 번째 한 줄을 기다리고 있어요'}</strong>
      <p>{filtered ? '검색어나 분류를 바꾸면 다른 기록을 찾을 수 있어요.' : '대단한 이야기가 아니어도 괜찮아요. 오늘의 기분부터 가볍게 남겨보세요.'}</p>
      <button type="button" onClick={filtered ? onReset : onWrite}>
        {filtered ? '필터 모두 지우기' : '첫 기록 쓰기'}
      </button>
    </div>
  );
}

export default function DailyMemoPage({ navigate, notes = [], path, refresh, session }) {
  const initialEditId = paramsForPath(path).get('edit') || '';
  const initialEditNote = notes.find((note) => note.id === initialEditId) || null;
  const initialEditableNote = initialEditNote && !requiresFullEditor(initialEditNote) ? initialEditNote : null;
  const recoveredDraft = readDailyMemoDraft(session, initialEditableNote?.id || '');
  const [draft, setDraft] = useState(() => uiDraft(initialEditableNote, recoveredDraft));
  const [editingId, setEditingId] = useState(initialEditableNote?.id || '');
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(DAILY_MEMO_ALL_TAG);
  const [view, setView] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const composerRef = useRef(null);
  const searchInputRef = useRef(null);
  const historyClosePendingRef = useRef(false);
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();

  const rhythm = useMemo(() => dailyMemoRhythm(notes), [notes]);
  const availableTags = useMemo(() => {
    const noteTags = notes.flatMap(dailyMemoTags);
    return [...new Set([...DAILY_MEMO_QUICK_TAGS, ...noteTags])].slice(0, 12);
  }, [notes]);
  const visibleNotes = useMemo(() => dailyMemoSearch(notes, {
    query,
    tag: selectedTag,
    view
  }), [notes, query, selectedTag, view]);
  const filtering = Boolean(query.trim() || selectedTag !== DAILY_MEMO_ALL_TAG || view !== 'all');
  const today = new Date();
  const greeting = greetingForHour(today.getHours());

  const focusComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.requestAnimationFrame(() => composerRef.current?.querySelector('textarea')?.focus({ preventScroll: true }));
  };

  const persistDraft = (memoId = editingId, currentDraft = draft) => {
    if (hasDraftContent(currentDraft)) saveDailyMemoDraft(session, currentDraft, memoId);
    else clearDailyMemoDraft(session, memoId);
  };

  const resetComposer = ({ focus = false } = {}) => {
    if (historyClosePendingRef.current) return;
    const previousEditingId = editingId;
    clearDailyMemoDraft(session, previousEditingId);
    setEditingId('');
    setDraft(uiDraft(null, previousEditingId ? readDailyMemoDraft(session) : null));
    if (window.location.pathname === '/memo' && paramsForPath(window.location.search).has('edit')) {
      historyClosePendingRef.current = true;
      closeMemoEditorPath();
    }
    if (focus) window.requestAnimationFrame(focusComposer);
  };

  const leaveEditing = () => {
    persistDraft();
    setEditingId('');
    setDraft(uiDraft(null, readDailyMemoDraft(session)));
  };

  const openRichNote = (note) => {
    persistDraft();
    notify('서식이나 일정이 연결된 메모는 자세히 편집할 수 있는 화면에서 열었어요.');
    navigate(richEditorPath(note));
  };

  const startEditing = (note) => {
    if (requiresFullEditor(note)) {
      openRichNote(note);
      return;
    }
    persistDraft();
    setEditingId(note.id);
    setDraft(uiDraft(note, readDailyMemoDraft(session, note.id)));
    historyClosePendingRef.current = false;
    pushMemoEditorPath(`/memo?edit=${encodeURIComponent(note.id)}`);
    window.requestAnimationFrame(focusComposer);
  };

  useEffect(() => {
    ensureDailyMemoBoards(session);
  }, [session?.username, session?.isGuest]);

  useEffect(() => {
    const targetId = paramsForPath(path).get('edit');
    if (!targetId) {
      historyClosePendingRef.current = false;
      if (editingId) leaveEditing();
      return;
    }
    if (historyClosePendingRef.current) return;
    const target = notes.find((note) => note.id === targetId);
    if (!target) return;
    if (requiresFullEditor(target)) {
      persistDraft();
      navigate(richEditorPath(target));
      return;
    }
    ensureMemoEditorHistory();
    if (target.id === editingId) return;
    persistDraft();
    setEditingId(target.id);
    setDraft(uiDraft(target, readDailyMemoDraft(session, target.id)));
    window.requestAnimationFrame(focusComposer);
  }, [path, notes]);

  useEffect(() => {
    persistDraft();
  }, [draft, editingId, session?.username, session?.isGuest]);

  useEffect(() => {
    if (!searchOpen) return;
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [searchOpen]);

  const submitMemo = (event) => {
    event.preventDefault();
    if (!draft.title.trim() && !draft.body.trim()) {
      notify('떠오른 내용을 한 줄만 적어주세요.', 'error');
      return;
    }

    const storedNotes = readDailyMemos(session);
    const previous = editingId ? storedNotes.find((note) => note.id === editingId) : null;
    if (editingId && (!previous || requiresFullEditor(previous))) {
      notify('이 메모는 간편 편집으로 바꿀 수 없어 안전한 편집 화면으로 이동할게요.', 'error');
      if (previous) openRichNote(previous);
      else resetComposer();
      return;
    }

    const nextNote = buildDailyMemo({ ...draft, tags: tagsForSave(draft) }, previous);
    const nextNotes = previous
      ? storedNotes.map((note) => (note.id === previous.id ? nextNote : note))
      : [nextNote, ...storedNotes];
    const result = saveDailyMemos(session, nextNotes);
    if (!result.saved) {
      notify('저장 공간을 확인해주세요. 메모를 저장하지 못했어요.', 'error');
      return;
    }

    const wasEditing = Boolean(editingId);
    resetComposer();
    refresh();
    notify(wasEditing ? '기록을 새 내용으로 다듬었어요.' : '오늘의 기록을 소중히 남겼어요.');
  };

  const togglePinned = (note) => {
    const nextNotes = readDailyMemos(session).map((item) => (
      item.id === note.id
        ? { ...item, pinned: !item.pinned, pinnedAt: !item.pinned ? new Date().toISOString() : '' }
        : item
    ));
    const result = saveDailyMemos(session, nextNotes);
    if (result.saved) refresh();
    notify(result.saved
      ? (note.pinned ? '중요 기록에서 내렸어요.' : '언제든 먼저 볼 수 있게 고정했어요.')
      : '고정 상태를 저장하지 못했어요.', result.saved ? 'success' : 'error');
  };

  const deleteMemo = (note) => {
    if (!window.confirm('이 기록을 삭제할까요? 삭제한 기록은 되돌릴 수 없어요.')) return;
    const removal = removeDailyMemoById(readDailyMemos(session), note?.id);
    if (!removal.removed) {
      notify('삭제할 기록을 찾지 못했어요. 목록을 새로고침한 뒤 다시 시도해주세요.', 'error');
      refresh();
      return;
    }
    const result = saveDailyMemos(session, removal.items);
    if (result.saved && editingId === note.id) resetComposer();
    if (result.saved) {
      clearDailyMemoDraft(session, note.id);
      refresh();
    }
    notify(result.saved ? '기록을 삭제했어요.' : '기록을 삭제하지 못했어요.', result.saved ? 'success' : 'error');
  };

  const resetFilters = () => {
    setQuery('');
    setSelectedTag(DAILY_MEMO_ALL_TAG);
    setView('all');
    setSearchOpen(false);
  };

  return (
    <div className="dailyMemo lifeHubPage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />

      <section className={`dailyMemoWelcome${notes.length ? ' hasRecords' : ''}`} aria-labelledby="dailyMemoWelcomeTitle">
        <div className="dailyMemoWelcomeCopy">
          <DailyMemoMark />
          <div>
            <span>{DATE_FORMATTER.format(today)}</span>
            <h2 id="dailyMemoWelcomeTitle">{greeting}</h2>
            <p>{rhythm.todayCount
              ? `오늘 ${rhythm.todayCount}개의 생각을 잘 남겨두었어요.`
              : '완벽하지 않아도 괜찮아요. 지금의 한 줄이면 충분해요.'}</p>
          </div>
        </div>
        <div className="dailyMemoRhythm" aria-label="기록 리듬">
          <article>
            <span><DailyMemoIcon name="note" size={18} /> 오늘</span>
            <strong>{rhythm.todayCount}<small>개</small></strong>
          </article>
          <article>
            <span><DailyMemoIcon name="calendar" size={18} /> 이번 주</span>
            <strong>{rhythm.weekDays}<small>일</small></strong>
          </article>
          <article className={rhythm.streak ? 'isWarm' : ''}>
            <span><DailyMemoIcon name="flame" size={18} /> 이어쓰기</span>
            <strong>{rhythm.streak}<small>일</small></strong>
          </article>
        </div>
      </section>

      <DailyMemoComposer
        ref={composerRef}
        draft={draft}
        editing={Boolean(editingId)}
        quickTags={DAILY_MEMO_QUICK_TAGS}
        onCancel={() => resetComposer({ focus: true })}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onSubmit={submitMemo}
        onToggleTag={(tag) => setDraft((current) => ({
          ...current,
          tags: current.tags.includes(tag)
            ? current.tags.filter((item) => item !== tag)
            : [...current.tags, tag]
        }))}
      />

      <section className="dailyMemoArchive" aria-labelledby="dailyMemoArchiveTitle">
        <header className="dailyMemoArchiveHeader">
          <div>
            <span className="dailyMemoEyebrow">차곡차곡 모인 마음</span>
            <h2 id="dailyMemoArchiveTitle">나의 기록</h2>
            <p>{notes.length ? `지금까지 ${notes.length}개의 순간을 간직했어요.` : '첫 기록부터 여기에 차곡차곡 모아둘게요.'}</p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setSearchOpen((open) => {
                if (open) setQuery('');
                return !open;
              })}
              aria-label={searchOpen ? '기록 검색 닫기' : '기록 검색'}
              aria-expanded={searchOpen}
            >
              <DailyMemoIcon name="search" size={20} />
            </button>
            <button type="button" className="isPrimary" onClick={focusComposer} aria-label="새 메모 작성">
              <DailyMemoIcon name="edit" size={19} />
              <span>새 메모</span>
            </button>
          </div>
        </header>

        <div className="dailyMemoFilters">
          {searchOpen ? (
            <label className="dailyMemoSearch">
              <DailyMemoIcon name="search" size={19} />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="기억하고 싶은 단어를 찾아보세요"
                aria-label="메모 검색어"
              />
              {query ? (
                <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기">
                  <DailyMemoIcon name="close" size={17} />
                </button>
              ) : null}
            </label>
          ) : null}

          <div className="dailyMemoViewTabs" role="group" aria-label="기록 보기 방식">
            <button type="button" className={view === 'all' ? 'isActive' : ''} aria-pressed={view === 'all'} onClick={() => setView('all')}>모든 기록</button>
            <button type="button" className={view === 'pinned' ? 'isActive' : ''} aria-pressed={view === 'pinned'} onClick={() => setView('pinned')}>
              <DailyMemoIcon name="pin" size={15} /> 중요 기록
            </button>
          </div>

          {notes.length ? (
            <div className="dailyMemoTagFilters" aria-label="태그 필터">
              <button
                type="button"
                className={selectedTag === DAILY_MEMO_ALL_TAG ? 'isActive' : ''}
                aria-pressed={selectedTag === DAILY_MEMO_ALL_TAG}
                onClick={() => setSelectedTag(DAILY_MEMO_ALL_TAG)}
              >
                전체
              </button>
              {availableTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className={selectedTag === tag ? 'isActive' : ''}
                  aria-pressed={selectedTag === tag}
                  onClick={() => setSelectedTag(tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {visibleNotes.length ? (
          <div className="dailyMemoGrid">
            {visibleNotes.map((note) => (
              <DailyMemoCard
                key={note.id}
                title={dailyMemoTitle(note)}
                body={dailyMemoBody(note)}
                dateLabel={formatDailyMemoTime(note.updatedAt || note.createdAt)}
                tags={dailyMemoTags(note)}
                pinned={note.pinned}
                isRich={requiresFullEditor(note)}
                onEdit={() => startEditing(note)}
                onPin={() => togglePinned(note)}
                onDelete={() => deleteMemo(note)}
              />
            ))}
          </div>
        ) : (
          <DailyMemoEmpty filtered={filtering} onReset={resetFilters} onWrite={focusComposer} />
        )}
      </section>
    </div>
  );
}
