import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_NOTE_DIRECTORY_ID_SET } from '../notesDirectoryRules.js';
import DailyMemoIcon from './DailyMemoIcon.jsx';
import { DAILY_MEMO_ALL_FOLDER } from './dailyMemoModel.js';

function folderName(folder) {
  return String(folder?.name || folder?.title || '').trim() || '폴더';
}

function folderRows(folders) {
  const source = Array.isArray(folders) ? folders : [];
  const byParent = new Map();
  source.forEach((folder) => {
    const parentId = folder.parentId && source.some((item) => item.id === folder.parentId)
      ? folder.parentId
      : null;
    const children = byParent.get(parentId) || [];
    children.push(folder);
    byParent.set(parentId, children);
  });
  byParent.forEach((children) => children.sort((left, right) => (
    (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0)
    || folderName(left).localeCompare(folderName(right), 'ko')
  )));

  const rows = [];
  const visited = new Set();
  const append = (folder, depth) => {
    if (!folder || visited.has(folder.id)) return;
    visited.add(folder.id);
    rows.push({ folder, depth });
    (byParent.get(folder.id) || []).forEach((child) => append(child, depth + 1));
  };
  (byParent.get(null) || []).forEach((folder) => append(folder, 0));
  source.forEach((folder) => append(folder, 0));
  return rows;
}

function FolderPanel({
  activeFolderId,
  counts,
  folders,
  mobile = false,
  onClose,
  onCreate,
  onDelete,
  onRename,
  onSelect,
  totalCount
}) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [menuId, setMenuId] = useState('');
  const [renamingId, setRenamingId] = useState('');
  const [renameName, setRenameName] = useState('');
  const rows = useMemo(() => folderRows(folders), [folders]);

  useEffect(() => {
    if (!mobile) return undefined;
    const restoreTarget = document.activeElement;
    closeButtonRef.current?.focus({ preventScroll: true });
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = panelRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
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
      restoreTarget?.focus?.({ preventScroll: true });
    };
  }, [mobile, onClose]);

  useEffect(() => {
    if (!menuId) return undefined;
    const closeMenu = (event) => {
      if (!panelRef.current?.contains(event.target)) setMenuId('');
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [menuId]);

  const selectFolder = (folderId) => {
    onSelect(folderId);
    if (mobile) onClose?.();
  };

  const submitCreate = (event) => {
    event.preventDefault();
    const name = createName.trim();
    if (!name) return;
    if (onCreate(name) !== false) {
      setCreateName('');
      setCreating(false);
    }
  };

  const submitRename = (event, folder) => {
    event.preventDefault();
    const name = renameName.trim();
    if (name && onRename(folder.id, name) !== false) {
      setRenamingId('');
      setRenameName('');
    }
  };

  return (
    <aside
      ref={panelRef}
      className={`dailyMemoFolderPanel${mobile ? ' isMobile' : ' isDesktop'}`}
      aria-label={mobile ? undefined : '메모 폴더'}
      aria-labelledby={mobile ? 'dailyMemoFolderDialogTitle' : undefined}
      aria-modal={mobile ? 'true' : undefined}
      role={mobile ? 'dialog' : undefined}
    >
      <header>
        <strong id={mobile ? 'dailyMemoFolderDialogTitle' : undefined}>폴더</strong>
        <div>
          <button
            type="button"
            onClick={() => {
              setCreating((open) => !open);
              setMenuId('');
            }}
            aria-label="새 폴더 만들기"
            aria-expanded={creating}
            title="새 폴더"
          >
            <DailyMemoIcon name="plus" size={19} />
          </button>
          {mobile ? (
            <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="폴더 닫기">
              <DailyMemoIcon name="close" size={19} />
            </button>
          ) : null}
        </div>
      </header>

      {creating ? (
        <form className="dailyMemoFolderForm" onSubmit={submitCreate}>
          <label className="dailyMemoSrOnly" htmlFor={`dailyMemoFolderName-${mobile ? 'mobile' : 'desktop'}`}>새 폴더 이름</label>
          <input
            id={`dailyMemoFolderName-${mobile ? 'mobile' : 'desktop'}`}
            autoFocus
            value={createName}
            maxLength={40}
            onChange={(event) => setCreateName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setCreating(false);
                setCreateName('');
              }
            }}
            placeholder="폴더 이름"
          />
          <button type="submit" disabled={!createName.trim()}>추가</button>
        </form>
      ) : null}

      <nav className="dailyMemoFolderList" aria-label="메모 폴더 목록">
        <button
          type="button"
          className={activeFolderId === DAILY_MEMO_ALL_FOLDER ? 'isActive' : ''}
          aria-current={activeFolderId === DAILY_MEMO_ALL_FOLDER ? 'page' : undefined}
          onClick={() => selectFolder(DAILY_MEMO_ALL_FOLDER)}
        >
          <DailyMemoIcon name="note" size={19} />
          <span>전체 메모</span>
          <small>{totalCount}</small>
        </button>

        {rows.map(({ folder, depth }) => {
          const active = activeFolderId === folder.id;
          const manageable = !DEFAULT_NOTE_DIRECTORY_ID_SET.has(folder.id);
          return (
            <div className={`dailyMemoFolderRow${manageable ? ' isManageable' : ''}`} key={folder.id} style={{ '--daily-memo-folder-depth': Math.min(depth, 4) }}>
              {renamingId === folder.id ? (
                <form onSubmit={(event) => submitRename(event, folder)}>
                  <DailyMemoIcon name="folder" size={18} />
                  <input
                    autoFocus
                    value={renameName}
                    maxLength={40}
                    aria-label={`${folderName(folder)} 폴더 새 이름`}
                    onChange={(event) => setRenameName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setRenamingId('');
                        setRenameName('');
                      }
                    }}
                  />
                  <button type="submit" disabled={!renameName.trim()} aria-label="폴더 이름 저장">
                    <DailyMemoIcon name="check" size={17} />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className={active ? 'isActive' : ''}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => selectFolder(folder.id)}
                >
                  <DailyMemoIcon name="folder" size={19} />
                  <span>{folderName(folder)}</span>
                  <small>{counts[folder.id] || 0}</small>
                </button>
              )}
              {manageable && renamingId !== folder.id ? (
                <div className="dailyMemoFolderMenu">
                  <button
                    type="button"
                    className={menuId === folder.id ? 'isActive' : ''}
                    aria-label={`${folderName(folder)} 폴더 작업`}
                    aria-expanded={menuId === folder.id}
                    onClick={() => setMenuId((current) => (current === folder.id ? '' : folder.id))}
                  >
                    <DailyMemoIcon name="more" size={18} />
                  </button>
                  {menuId === folder.id ? (
                    <div role="group" aria-label={`${folderName(folder)} 폴더 작업 메뉴`}>
                      <button type="button" onClick={() => {
                        setRenamingId(folder.id);
                        setRenameName(folderName(folder));
                        setMenuId('');
                      }}>
                        <DailyMemoIcon name="edit" size={16} /> 이름 변경
                      </button>
                      <button type="button" className="isDanger" onClick={() => {
                        setMenuId('');
                        onDelete(folder.id);
                      }}>
                        <DailyMemoIcon name="trash" size={16} /> 삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <p>메모를 편집할 때 폴더를 옮길 수 있어요.</p>
    </aside>
  );
}

export default function DailyMemoFolders(props) {
  useEffect(() => {
    if (!props.mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [props.mobileOpen]);

  return (
    <>
      <FolderPanel {...props} />
      {props.mobileOpen ? (
        <div className="dailyMemoFolderBackdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) props.onClose?.();
        }}>
          <FolderPanel {...props} mobile />
        </div>
      ) : null}
    </>
  );
}
