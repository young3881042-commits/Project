import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FeedbackToast, useLifeHubFeedback } from '../../lifehub/LifeHubUi.jsx';
import DailyMemoCard from './DailyMemoCard.jsx';
import DailyMemoComposer from './DailyMemoComposer.jsx';
import DailyMemoFolders from './DailyMemoFolders.jsx';
import DailyMemoIcon from './DailyMemoIcon.jsx';
import DailyMemoReader from './DailyMemoReader.jsx';
import {
  DAILY_MEMO_ALL_TAG,
  DAILY_MEMO_ALL_FOLDER,
  DAILY_MEMO_QUICK_TAGS,
  buildDailyMemo,
  clearDailyMemoDraft,
  createDailyMemoDraft,
  dailyMemoBody,
  dailyMemoFolderId,
  dailyMemoSearch,
  dailyMemoTags,
  dailyMemoTitle,
  ensureDailyMemoBoards,
  formatDailyMemoTime,
  isRichDailyMemo,
  readDailyMemoDraft,
  readDailyMemoFolders,
  readDailyMemos,
  removeDailyMemoById,
  saveDailyMemoDraft,
  saveDailyMemoFolders,
  saveDailyMemos
} from './dailyMemoModel.js';

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
  const source = recovered && typeof recovered === 'object'
    ? { ...createDailyMemoDraft(), ...recovered }
    : createDailyMemoDraft(note);
  const tags = Array.isArray(source.tags) ? source.tags : [];
  const quickTags = tags.filter((tag) => DAILY_MEMO_QUICK_TAGS.includes(tag));
  const customTags = typeof source.customTags === 'string'
    ? source.customTags
    : tags.filter((tag) => !DAILY_MEMO_QUICK_TAGS.includes(tag)).join(', ');
  return {
    title: String(source.title || ''),
    body: String(source.body || ''),
    tags: quickTags,
    customTags,
    folderId: String(source.folderId || source.boardId || source.sector || 'personal')
  };
}

function newFolderId() {
  const randomId = globalThis.crypto?.randomUUID?.() || Math.random().toString(16).slice(2);
  return `folder-${Date.now()}-${randomId}`;
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

function isLegacyRichMemo(note) {
  return Boolean(isRichDailyMemo(note) || note?.schedule?.enabled || note?.scheduleEnabled);
}

function DailyMemoEmpty({ filtered, onReset, onWrite }) {
  return (
    <div className="dailyMemoEmpty">
      <span><DailyMemoIcon name={filtered ? 'search' : 'leaf'} size={27} /></span>
      <strong>{filtered ? '조건에 맞는 메모가 없어요' : '아직 저장된 메모가 없어요'}</strong>
      <p>{filtered ? '검색어나 분류를 바꾸면 다른 메모를 찾을 수 있어요.' : '위 작성란에 내용을 입력해 첫 메모를 저장해보세요.'}</p>
      <button type="button" onClick={filtered ? onReset : onWrite}>
        {filtered ? '필터 모두 지우기' : '첫 메모 쓰기'}
      </button>
    </div>
  );
}

export default function DailyMemoPage({ notes = [], path, refresh, session }) {
  const initialEditId = paramsForPath(path).get('edit') || '';
  const initialEditNote = notes.find((note) => note.id === initialEditId) || null;
  const initialEditableNote = initialEditNote && !isLegacyRichMemo(initialEditNote) ? initialEditNote : null;
  const recoveredDraft = readDailyMemoDraft(session, initialEditableNote?.id || '');
  const [draft, setDraft] = useState(() => uiDraft(initialEditableNote, recoveredDraft));
  const [editingId, setEditingId] = useState(initialEditableNote?.id || '');
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(DAILY_MEMO_ALL_TAG);
  const [view, setView] = useState('all');
  const [folders, setFolders] = useState(() => readDailyMemoFolders(session, notes));
  const [activeFolderId, setActiveFolderId] = useState(DAILY_MEMO_ALL_FOLDER);
  const [folderDrawerOpen, setFolderDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftRecoveryStatus, setDraftRecoveryStatus] = useState('idle');
  const [readerNote, setReaderNote] = useState(() => (
    initialEditNote && isLegacyRichMemo(initialEditNote) ? initialEditNote : null
  ));
  const composerRef = useRef(null);
  const searchInputRef = useRef(null);
  const historyClosePendingRef = useRef(false);
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const closeReader = useCallback(() => setReaderNote(null), []);
  const closeFolderDrawer = useCallback(() => setFolderDrawerOpen(false), []);

  const folderCounts = useMemo(() => notes.reduce((counts, note) => {
    const folderId = dailyMemoFolderId(note);
    counts[folderId] = (counts[folderId] || 0) + 1;
    return counts;
  }, {}), [notes]);
  const activeFolder = folders.find((folder) => folder.id === activeFolderId) || null;
  const activeFolderName = activeFolderId === DAILY_MEMO_ALL_FOLDER
    ? '전체 메모'
    : String(activeFolder?.name || activeFolder?.title || '폴더');
  const folderNotes = useMemo(() => (
    activeFolderId === DAILY_MEMO_ALL_FOLDER
      ? notes
      : notes.filter((note) => dailyMemoFolderId(note) === activeFolderId)
  ), [activeFolderId, notes]);

  const availableTags = useMemo(() => {
    const noteTags = folderNotes.flatMap(dailyMemoTags);
    return [...new Set(noteTags)].slice(0, 12);
  }, [folderNotes]);
  const visibleNotes = useMemo(() => dailyMemoSearch(folderNotes, {
    query,
    tag: selectedTag,
    view
  }), [folderNotes, query, selectedTag, view]);
  const filtering = Boolean(query.trim() || selectedTag !== DAILY_MEMO_ALL_TAG || view !== 'all');
  const pinnedCount = useMemo(() => folderNotes.filter((note) => note.pinned).length, [folderNotes]);
  const hasFilterChoices = Boolean(pinnedCount || availableTags.length || view !== 'all' || selectedTag !== DAILY_MEMO_ALL_TAG);

  const focusComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    composerRef.current?.focusEditor?.();
  };

  const persistDraft = (memoId = editingId, currentDraft = draft) => {
    if (hasDraftContent(currentDraft)) {
      const saved = saveDailyMemoDraft(session, currentDraft, memoId);
      setDraftRecoveryStatus(saved ? 'saved' : 'error');
      return saved;
    }
    clearDailyMemoDraft(session, memoId);
    setDraftRecoveryStatus('idle');
    return true;
  };

  const resetComposer = ({ focus = false } = {}) => {
    if (historyClosePendingRef.current) return;
    const previousEditingId = editingId;
    clearDailyMemoDraft(session, previousEditingId);
    setDraftRecoveryStatus('idle');
    setEditingId('');
    const nextDraft = uiDraft(null, previousEditingId ? readDailyMemoDraft(session) : null);
    if (!hasDraftContent(nextDraft) && activeFolderId !== DAILY_MEMO_ALL_FOLDER) {
      nextDraft.folderId = activeFolderId;
    }
    setDraft(nextDraft);
    if (window.location.pathname === '/memo' && paramsForPath(window.location.search).has('edit')) {
      historyClosePendingRef.current = true;
      closeMemoEditorPath();
    }
    if (focus) window.requestAnimationFrame(focusComposer);
  };

  const leaveEditing = () => {
    persistDraft();
    setEditingId('');
    const nextDraft = uiDraft(null, readDailyMemoDraft(session));
    if (!hasDraftContent(nextDraft) && activeFolderId !== DAILY_MEMO_ALL_FOLDER) nextDraft.folderId = activeFolderId;
    setDraft(nextDraft);
  };

  const openRichNote = (note) => {
    persistDraft();
    setReaderNote(note);
  };

  const startEditing = (note) => {
    if (isLegacyRichMemo(note)) {
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
    setFolders(readDailyMemoFolders(session, notes));
  }, [notes, session?.username, session?.isGuest]);

  useEffect(() => {
    if (activeFolderId === DAILY_MEMO_ALL_FOLDER) return;
    if (!folders.some((folder) => folder.id === activeFolderId)) setActiveFolderId(DAILY_MEMO_ALL_FOLDER);
  }, [activeFolderId, folders]);

  useEffect(() => {
    const targetId = paramsForPath(path).get('edit');
    if (!targetId) {
      historyClosePendingRef.current = false;
      if (editingId) leaveEditing();
      return;
    }
    if (historyClosePendingRef.current) return;
    const target = notes.find((note) => note.id === targetId);
    if (!target) {
      notify('열려던 메모를 찾지 못해 목록으로 돌아왔어요.', 'error');
      replaceMemoPath('/memo');
      return;
    }
    if (isLegacyRichMemo(target)) {
      persistDraft();
      setReaderNote(target);
      replaceMemoPath('/memo');
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

  useEffect(() => {
    if (paramsForPath(path).get('new') !== 'memo') return;
    window.requestAnimationFrame(focusComposer);
  }, [path]);

  const submitMemo = (event) => {
    event.preventDefault();
    if (!draft.title.trim() && !draft.body.trim()) {
      notify('떠오른 내용을 한 줄만 적어주세요.', 'error');
      return;
    }

    const storedNotes = readDailyMemos(session);
    const previous = editingId ? storedNotes.find((note) => note.id === editingId) : null;
    if (editingId && (!previous || isLegacyRichMemo(previous))) {
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
    notify(wasEditing ? '메모를 수정했어요.' : '메모를 저장했어요.');
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

  const copyRichMemoToText = () => {
    if (!readerNote) return;
    const original = readDailyMemos(session).find((note) => note.id === readerNote.id) || readerNote;
    const body = dailyMemoBody(original);
    if (!body) {
      notify('안전하게 변환할 텍스트 본문이 없어 원본을 그대로 유지했어요.', 'error');
      return;
    }

    const copy = buildDailyMemo({
      title: `${dailyMemoTitle(original)} · 사본`,
      body,
      tags: dailyMemoTags(original),
      folderId: dailyMemoFolderId(original)
    });
    const result = saveDailyMemos(session, [copy, ...readDailyMemos(session)]);
    if (!result.saved) {
      notify('텍스트 사본을 저장하지 못했어요. 원본은 그대로 유지돼요.', 'error');
      return;
    }

    setReaderNote(null);
    setEditingId(copy.id);
    setDraft(uiDraft(copy));
    setDraftRecoveryStatus('idle');
    historyClosePendingRef.current = false;
    refresh();
    pushMemoEditorPath(`/memo?edit=${encodeURIComponent(copy.id)}`);
    window.requestAnimationFrame(focusComposer);
    notify('원본은 보존하고 텍스트 사본을 만들었어요.');
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
    setFiltersOpen(false);
  };

  const selectFolder = (folderId) => {
    const nextFolderId = folderId === DAILY_MEMO_ALL_FOLDER || folders.some((folder) => folder.id === folderId)
      ? folderId
      : DAILY_MEMO_ALL_FOLDER;
    setActiveFolderId(nextFolderId);
    setQuery('');
    setSelectedTag(DAILY_MEMO_ALL_TAG);
    setView('all');
    setSearchOpen(false);
    setFiltersOpen(false);
    if (!editingId && nextFolderId !== DAILY_MEMO_ALL_FOLDER) {
      setDraft((current) => ({ ...current, folderId: nextFolderId }));
    }
  };

  const createFolder = (name) => {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return false;
    if (folders.some((folder) => String(folder.name || folder.title || '').trim().toLocaleLowerCase('ko-KR') === normalizedName.toLocaleLowerCase('ko-KR'))) {
      notify('같은 이름의 폴더가 이미 있어요.', 'error');
      return false;
    }
    const timestamp = new Date().toISOString();
    const folder = {
      id: newFolderId(),
      parentId: null,
      name: normalizedName,
      title: normalizedName,
      sortOrder: folders.length,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const result = saveDailyMemoFolders(session, [...folders, folder], notes);
    if (!result.saved) {
      notify('폴더를 저장하지 못했어요.', 'error');
      return false;
    }
    setFolders(result.items);
    setActiveFolderId(folder.id);
    setQuery('');
    setSelectedTag(DAILY_MEMO_ALL_TAG);
    setView('all');
    setSearchOpen(false);
    setFiltersOpen(false);
    if (!editingId) setDraft((current) => ({ ...current, folderId: folder.id }));
    notify(`${normalizedName} 폴더를 만들었어요.`);
    return true;
  };

  const renameFolder = (folderId, name) => {
    const normalizedName = String(name || '').trim();
    const target = folders.find((folder) => folder.id === folderId);
    if (!target || ['personal', 'travel'].includes(folderId) || !normalizedName) return false;
    if (folders.some((folder) => folder.id !== folderId
      && String(folder.name || folder.title || '').trim().toLocaleLowerCase('ko-KR') === normalizedName.toLocaleLowerCase('ko-KR'))) {
      notify('같은 이름의 폴더가 이미 있어요.', 'error');
      return false;
    }
    const result = saveDailyMemoFolders(session, folders.map((folder) => (
      folder.id === folderId
        ? { ...folder, name: normalizedName, title: normalizedName, updatedAt: new Date().toISOString() }
        : folder
    )), notes);
    if (!result.saved) {
      notify('폴더 이름을 저장하지 못했어요.', 'error');
      return false;
    }
    setFolders(result.items);
    notify('폴더 이름을 바꿨어요.');
    return true;
  };

  const deleteFolder = (folderId) => {
    const target = folders.find((folder) => folder.id === folderId);
    if (!target || ['personal', 'travel'].includes(folderId)) return;
    const targetName = String(target.name || target.title || '선택한');
    if (!window.confirm(`${targetName} 폴더를 삭제할까요? 안의 메모는 개인 폴더로 이동해요.`)) return;

    const storedNotes = readDailyMemos(session);
    const movedNotes = storedNotes.map((note) => (
      dailyMemoFolderId(note) === folderId
        ? { ...note, folderId: 'personal', boardId: 'personal', sector: 'personal', updatedAt: new Date().toISOString() }
        : note
    ));
    const movedCount = storedNotes.filter((note) => dailyMemoFolderId(note) === folderId).length;
    const notesResult = movedCount ? saveDailyMemos(session, movedNotes) : { items: storedNotes, saved: true };
    if (!notesResult.saved) {
      notify('메모를 안전하게 옮기지 못해 폴더를 삭제하지 않았어요.', 'error');
      return;
    }
    const fallbackParentId = target.parentId && target.parentId !== folderId ? target.parentId : null;
    const nextFolders = folders
      .filter((folder) => folder.id !== folderId)
      .map((folder) => (folder.parentId === folderId ? { ...folder, parentId: fallbackParentId } : folder));
    const folderResult = saveDailyMemoFolders(session, nextFolders, notesResult.items);
    if (!folderResult.saved) {
      notify('메모는 개인 폴더로 옮겼지만 폴더 삭제를 저장하지 못했어요.', 'error');
      refresh();
      return;
    }
    setFolders(folderResult.items);
    if (activeFolderId === folderId) setActiveFolderId('personal');
    setDraft((current) => (current.folderId === folderId ? { ...current, folderId: 'personal' } : current));
    refresh();
    notify(movedCount ? `폴더를 삭제하고 메모 ${movedCount}개를 개인으로 옮겼어요.` : '빈 폴더를 삭제했어요.');
  };

  const moveMemo = (note, folderId) => {
    if (!folders.some((folder) => folder.id === folderId) || dailyMemoFolderId(note) === folderId) return;
    const storedNotes = readDailyMemos(session);
    const nextNotes = storedNotes.map((item) => (
      item.id === note.id
        ? { ...item, folderId, boardId: folderId, sector: folderId, updatedAt: new Date().toISOString() }
        : item
    ));
    const result = saveDailyMemos(session, nextNotes);
    if (!result.saved) {
      notify('메모를 다른 폴더로 옮기지 못했어요.', 'error');
      return;
    }
    if (editingId === note.id) setDraft((current) => ({ ...current, folderId }));
    refresh();
    const destination = folders.find((folder) => folder.id === folderId);
    notify(`${String(destination?.name || destination?.title || '선택한')} 폴더로 옮겼어요.`);
  };

  return (
    <div className="dailyMemo lifeHubPage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      {readerNote ? (
        <DailyMemoReader
          body={dailyMemoBody(readerNote)}
          dateLabel={formatDailyMemoTime(readerNote.updatedAt || readerNote.createdAt)}
          onClose={closeReader}
          onCopy={copyRichMemoToText}
          tags={dailyMemoTags(readerNote)}
          title={dailyMemoTitle(readerNote)}
        />
      ) : null}

      <button
        type="button"
        className="dailyMemoMobileFolderButton"
        onClick={() => setFolderDrawerOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={folderDrawerOpen}
      >
        <DailyMemoIcon name="folder" size={19} />
        <span>{activeFolderName}</span>
        <small>{folderNotes.length}</small>
        <DailyMemoIcon name="chevronRight" size={18} />
      </button>

      <div className="dailyMemoWorkspace">
        <DailyMemoFolders
          activeFolderId={activeFolderId}
          counts={folderCounts}
          folders={folders}
          mobileOpen={folderDrawerOpen}
          onClose={closeFolderDrawer}
          onCreate={createFolder}
          onDelete={deleteFolder}
          onRename={renameFolder}
          onSelect={selectFolder}
          totalCount={notes.length}
        />

        <div className="dailyMemoMain">
          <DailyMemoComposer
            ref={composerRef}
            draft={draft}
            draftRecoveryStatus={draftRecoveryStatus}
            editing={Boolean(editingId)}
            folders={folders}
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
          <div className="dailyMemoArchiveTitle">
            <h2 id="dailyMemoArchiveTitle">{activeFolderName}</h2>
            <span>{folderNotes.length}</span>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setSearchOpen((open) => {
                if (open) setQuery('');
                else setFiltersOpen(false);
                return !open;
              })}
              className={searchOpen ? 'isActive' : ''}
              aria-label={searchOpen ? '기록 검색 닫기' : '기록 검색'}
              aria-expanded={searchOpen}
              aria-controls="dailyMemoFilters"
              title={searchOpen ? '검색 닫기' : '메모 검색'}
            >
              <DailyMemoIcon name="search" size={20} />
            </button>
            {hasFilterChoices ? (
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => {
                  if (!open) {
                    setSearchOpen(false);
                    setQuery('');
                  }
                  return !open;
                })}
                className={filtersOpen || selectedTag !== DAILY_MEMO_ALL_TAG || view !== 'all' ? 'isActive' : ''}
                aria-label={filtersOpen ? '메모 필터 닫기' : '메모 필터 열기'}
                aria-expanded={filtersOpen}
                aria-controls="dailyMemoFilterChoices"
                title="메모 필터"
              >
                <DailyMemoIcon name="tag" size={19} />
              </button>
            ) : null}
          </div>
        </header>

        <div id="dailyMemoFilters" className="dailyMemoFilters">
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
                <button type="button" onClick={() => { setQuery(''); searchInputRef.current?.focus(); }} aria-label="검색어 지우기">
                  <DailyMemoIcon name="close" size={17} />
                </button>
              ) : null}
            </label>
          ) : null}

          {filtersOpen ? (
            <div id="dailyMemoFilterChoices" className="dailyMemoFilterChoices">
              {pinnedCount || view === 'pinned' ? (
                <div className="dailyMemoViewTabs" role="group" aria-label="메모 보기 방식">
                  <button type="button" className={view === 'all' ? 'isActive' : ''} aria-pressed={view === 'all'} onClick={() => setView('all')}>
                    전체 {folderNotes.length}
                  </button>
                  <button type="button" className={view === 'pinned' ? 'isActive' : ''} aria-pressed={view === 'pinned'} onClick={() => setView('pinned')}>
                    <DailyMemoIcon name="pin" size={15} /> 중요 {pinnedCount}
                  </button>
                </div>
              ) : null}
              {availableTags.length ? (
                <div className="dailyMemoTagFilters" aria-label="태그 필터">
                  <button
                    type="button"
                    className={selectedTag === DAILY_MEMO_ALL_TAG ? 'isActive' : ''}
                    aria-pressed={selectedTag === DAILY_MEMO_ALL_TAG}
                    onClick={() => setSelectedTag(DAILY_MEMO_ALL_TAG)}
                  >
                    모든 태그
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
          ) : null}

          {filtering ? (
            <div className="dailyMemoFilterStatus" role="status">
              <span>메모 {visibleNotes.length}개</span>
              <button type="button" onClick={resetFilters}>초기화</button>
            </div>
          ) : null}
        </div>

        {visibleNotes.length ? (
          <div id="dailyMemoList" className="dailyMemoGrid">
            {visibleNotes.map((note) => (
              <DailyMemoCard
                key={note.id}
                title={dailyMemoTitle(note)}
                body={dailyMemoBody(note)}
                dateLabel={formatDailyMemoTime(note.updatedAt || note.createdAt)}
                tags={dailyMemoTags(note)}
                pinned={note.pinned}
                isRich={isLegacyRichMemo(note)}
                folderId={dailyMemoFolderId(note)}
                folders={folders}
                onEdit={() => startEditing(note)}
                onPin={() => togglePinned(note)}
                onMove={(folderId) => moveMemo(note, folderId)}
                onDelete={() => deleteMemo(note)}
              />
            ))}
          </div>
        ) : (
          <DailyMemoEmpty filtered={filtering} onReset={resetFilters} onWrite={focusComposer} />
        )}
          </section>
        </div>
      </div>
    </div>
  );
}
