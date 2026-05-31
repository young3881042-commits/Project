import { useEffect, useState } from 'react';
import MemoNavIcon from '../MemoNavIcon.jsx';

export default function SidebarFolderTree({
  folders,
  activeFolderId,
  noteCounts,
  onSelect,
  onAddFolder,
  onCreateNote,
  onRenameFolder,
  onDeleteFolder,
  getFolderChildren,
  getFolderName,
  canDeleteFolder
}) {
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState('');
  const [expandedFolderIds, setExpandedFolderIds] = useState(() => new Set());
  const [openMenu, setOpenMenu] = useState(null);

  useEffect(() => {
    const existingIds = new Set(folders.map((folder) => folder.id));
    setExpandedFolderIds((current) => new Set([...current].filter((folderId) => existingIds.has(folderId))));
  }, [folders]);

  const commitRename = (folder) => {
    const nextName = draft.trim();
    if (nextName) onRenameFolder(folder.id, nextName);
    setEditingId('');
    setDraft('');
  };

  const toggleFolder = (folderId) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const renderFolder = (folder, depth = 0) => {
    const children = getFolderChildren(folders, folder.id);
    const expanded = expandedFolderIds.has(folder.id);
    const active = activeFolderId === folder.id;
    return (
      <div className="notesFolderNode" key={folder.id}>
        <div className={`notesFolderRow ${active ? 'active' : ''}`} style={{ '--folder-depth': depth }}>
          {editingId === folder.id ? (
            <label className="notesFolderRenameField">
              <MemoNavIcon type="folder" />
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => commitRename(folder)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitRename(folder);
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setEditingId('');
                    setDraft('');
                  }
                }}
                aria-label="폴더 이름"
              />
            </label>
          ) : (
            <button
              type="button"
              className="notesFolderSelect"
              onClick={() => {
                onSelect(folder.id);
                if (children.length) toggleFolder(folder.id);
              }}
              onDoubleClick={() => {
                setEditingId(folder.id);
                setDraft(getFolderName(folder));
              }}
            >
              <MemoNavIcon type="folder" />
              <span>{getFolderName(folder)}</span>
              <small>{noteCounts[folder.id] || 0}</small>
            </button>
          )}
          <button
            type="button"
            className={`notesFolderToggle ${expanded ? 'expanded' : ''}`}
            onClick={() => toggleFolder(folder.id)}
            disabled={!children.length}
            aria-label={expanded ? '폴더 접기' : '폴더 펼치기'}
            title={expanded ? '폴더 접기' : '폴더 펼치기'}
          >
            <MemoNavIcon type="chevronRight" />
          </button>
          <div className="notesFolderMenuWrap">
            <button
              type="button"
              className="notesFolderIconButton"
              onClick={(event) => {
                event.stopPropagation();
                setOpenMenu(openMenu === `add-${folder.id}` ? null : `add-${folder.id}`);
              }}
              aria-label="폴더에 추가"
              title="폴더에 추가"
            >
              <MemoNavIcon type="plus" />
            </button>
            {openMenu === `add-${folder.id}` ? (
              <div className="notesFolderActionMenu">
                <button type="button" onClick={() => { onAddFolder(folder.id); setOpenMenu(null); }}>하위 폴더</button>
                <button type="button" onClick={() => { onCreateNote(folder.id); setOpenMenu(null); }}>메모</button>
              </div>
            ) : null}
          </div>
          <div className="notesFolderMenuWrap">
            <button
              type="button"
              className="notesFolderIconButton"
              onClick={(event) => {
                event.stopPropagation();
                setOpenMenu(openMenu === `more-${folder.id}` ? null : `more-${folder.id}`);
              }}
              aria-label="폴더 더보기"
              title="폴더 더보기"
            >
              ...
            </button>
            {openMenu === `more-${folder.id}` ? (
              <div className="notesFolderActionMenu">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(folder.id);
                    setDraft(getFolderName(folder));
                    setOpenMenu(null);
                  }}
                >
                  이름 변경
                </button>
                {canDeleteFolder(folder) ? (
                  <button type="button" className="danger" onClick={() => { onDeleteFolder(folder.id); setOpenMenu(null); }}>삭제</button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {children.length && expanded ? (
          <div className="notesFolderChildren">
            {children.map((child) => renderFolder(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="notesFolderPanel" aria-label="폴더 트리">
      <header>
        <strong>내 워크스페이스</strong>
        <button type="button" onClick={() => onAddFolder(null)}><MemoNavIcon type="plus" />새 폴더</button>
      </header>
      <div className="notesFolderTree">
        {getFolderChildren(folders, null).map((folder) => renderFolder(folder))}
      </div>
    </aside>
  );
}
