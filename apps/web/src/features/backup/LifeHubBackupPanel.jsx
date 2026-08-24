import { useEffect, useRef, useState } from 'react';
import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import {
  createLifeHubBackup,
  parseLifeHubBackup,
  planLifeHubBackupImport,
  serializeLifeHubBackup
} from './lifeHubBackupCodec.js';
import {
  assertBrowserBackupByteLimit,
  backupJsonByteLength,
  readBrowserBackupFile
} from './browserBackupDocuments.js';
import {
  exportNativeLifeHubBackup,
  hasNativeBackupDocumentApi,
  importNativeLifeHubBackup
} from './nativeBackupDocuments.js';

const COLLECTION_LABELS = {
  schedules: '일정',
  notes: '메모',
  budgetEntries: '가계부',
  recurringPayments: '정기 결제',
  trips: '여행'
};
const VISIBLE_BACKUP_COLLECTIONS = Object.freeze(Object.keys(COLLECTION_LABELS));

function backupFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `lifehub-backup-${year}-${month}-${day}.json`;
}

function downloadJson(json, fileName) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function totalCounts(counts) {
  return VISIBLE_BACKUP_COLLECTIONS.reduce((sum, key) => sum + (Number(counts?.[key]) || 0), 0);
}

function changedSingletonLabel(plan) {
  return plan?.dailyBriefingSettings?.overwritten ? '자동 브리핑 설정' : '';
}

function errorMessage(error, fallback) {
  if (error?.code === 'cancelled' || error?.code === 'CANCELLED') return '';
  if (error?.code === 'UNSUPPORTED_FUTURE_VERSION') return '더 최신 버전의 LifeHub에서 만든 백업이에요. 앱을 업데이트한 뒤 다시 시도해주세요.';
  if (error?.code === 'INVALID_PRODUCT') return 'LifeHub 백업 파일이 아니에요.';
  if (error?.code === 'INVALID_JSON') return 'JSON 백업 파일을 읽을 수 없어요.';
  if (error?.code === 'SENSITIVE_STATE') return '보안상 백업할 수 없는 Bridge 또는 대화 상태가 포함되어 있어요.';
  return String(error?.message || fallback);
}

export default function LifeHubBackupPanel({
  currentData,
  owner,
  appVersion = '0.0.1',
  onRestore
}) {
  const inputRef = useRef(null);
  const previewHeadingRef = useRef(null);
  const previewWasOpenRef = useRef(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [plan, setPlan] = useState(null);
  const [mode, setMode] = useState('merge');

  useEffect(() => {
    if (!snapshot) return;
    try {
      setPlan(planLifeHubBackupImport(currentData, snapshot, { mode }));
    } catch (planError) {
      setPlan(null);
      setError(errorMessage(planError, '복원 미리보기를 갱신하지 못했어요.'));
    }
  }, [currentData, snapshot, mode]);

  useEffect(() => {
    const previewOpen = Boolean(plan);
    if (previewOpen && !previewWasOpenRef.current) {
      previewHeadingRef.current?.focus();
    }
    previewWasOpenRef.current = previewOpen;
  }, [plan]);

  const preview = (backup, nextMode = mode) => {
    const parsed = parseLifeHubBackup(backup);
    const nextPlan = planLifeHubBackupImport(currentData, parsed, { mode: nextMode });
    setSnapshot(parsed);
    setPlan(nextPlan);
    setMode(nextMode);
    setMessage('');
    setError('');
  };

  const exportBackup = async () => {
    if (busy) return;
    setBusy('export');
    setMessage('');
    setError('');
    try {
      const backup = createLifeHubBackup({ owner, appVersion, data: currentData });
      const json = serializeLifeHubBackup(backup, 0);
      assertBrowserBackupByteLimit(backupJsonByteLength(json));
      const fileName = backupFileName();
      if (hasNativeBackupDocumentApi()) {
        try {
          await exportNativeLifeHubBackup({ fileName, json });
        } catch (nativeError) {
          if (!nativeError?.browserFallbackAllowed) throw nativeError;
          downloadJson(json, fileName);
        }
      } else {
        downloadJson(json, fileName);
      }
      setMessage('백업 파일을 저장했어요.');
    } catch (exportError) {
      const nextMessage = errorMessage(exportError, '백업 파일을 만들지 못했어요.');
      if (nextMessage) setError(nextMessage);
    } finally {
      setBusy('');
    }
  };

  const importBackup = async () => {
    if (busy) return;
    setMessage('');
    setError('');
    if (!hasNativeBackupDocumentApi()) {
      inputRef.current?.click();
      return;
    }
    setBusy('import');
    try {
      const result = await importNativeLifeHubBackup();
      preview(result.json, 'merge');
    } catch (importError) {
      if (importError?.browserFallbackAllowed) {
        inputRef.current?.click();
        return;
      }
      const nextMessage = errorMessage(importError, '백업 파일을 읽지 못했어요.');
      if (nextMessage) setError(nextMessage);
    } finally {
      setBusy('');
    }
  };

  const importBrowserFile = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    setBusy('import');
    setMessage('');
    setError('');
    try {
      preview(await readBrowserBackupFile(file), 'merge');
    } catch (importError) {
      setSnapshot(null);
      setPlan(null);
      setError(errorMessage(importError, '백업 파일을 읽지 못했어요.'));
    } finally {
      setBusy('');
    }
  };

  const changeMode = (nextMode) => {
    if (!snapshot || busy) return;
    try {
      preview(snapshot, nextMode);
    } catch (planError) {
      setError(errorMessage(planError, '복원 미리보기를 만들지 못했어요.'));
    }
  };

  const restoreBackup = async () => {
    if (!plan || !snapshot || busy) return;
    setBusy('restore');
    setMessage('');
    setError('');
    try {
      const confirmedPlan = planLifeHubBackupImport(currentData, snapshot, { mode });
      const result = await Promise.resolve(onRestore?.({
        ...confirmedPlan,
        backupSnapshot: snapshot
      }));
      if (!result?.saved) throw new Error(result?.message || '기존 데이터를 그대로 유지했어요.');
      setSnapshot(null);
      setPlan(null);
      setMessage(`${totalCounts(result.plan?.counts?.result || confirmedPlan.counts.result)}개 기록을 복원했어요.`);
    } catch (restoreError) {
      setError(errorMessage(restoreError, '복원하지 못했어요. 기존 데이터는 그대로 유지했어요.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <section
      className="lifeHubBackupPanel more-control-section"
      aria-labelledby="lifehub-backup-title"
      aria-busy={Boolean(busy)}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={importBrowserFile}
      />
      <header>
        <span><MemoNavIcon type="shield" /></span>
        <div>
          <strong id="lifehub-backup-title">백업과 복원</strong>
          <p>일정·메모·가계부·정기 결제·여행 기록을 JSON 파일로 옮길 수 있어요.</p>
        </div>
      </header>
      <div className="lifeHubBackupActions">
        <button type="button" onClick={exportBackup} disabled={Boolean(busy)}>
          {busy === 'export' ? '저장 중…' : '백업 파일 저장'}
        </button>
        <button type="button" onClick={importBackup} disabled={Boolean(busy)}>
          {busy === 'import' ? '읽는 중…' : '백업 파일 복원'}
        </button>
      </div>

      {message ? <p className="lifeHubBackupStatus success" role="status">{message}</p> : null}
      {error ? <p className="lifeHubBackupStatus error" role="alert">{error}</p> : null}

      {plan ? (
        <div className="lifeHubBackupPreview" role="region" aria-labelledby="lifehub-backup-preview-title">
          <div className="lifeHubBackupPreviewHeading">
            <div role="status" aria-live="polite">
              <strong id="lifehub-backup-preview-title" ref={previewHeadingRef} tabIndex={-1}>{totalCounts(plan.counts.incoming)}개 기록을 찾았어요</strong>
              <span>{new Date(plan.source.createdAt).toLocaleString('ko-KR')} · {plan.source.owner}</span>
            </div>
            <button type="button" className="quiet" onClick={() => { setSnapshot(null); setPlan(null); }} disabled={Boolean(busy)}>닫기</button>
          </div>

          <fieldset className="lifeHubBackupModes">
            <legend>복원 방식</legend>
            <label>
              <input type="radio" name="lifehub-backup-mode" checked={mode === 'merge'} onChange={() => changeMode('merge')} />
              <span><strong>합치기</strong><small>같은 ID는 백업 내용으로 바꾸고 나머지는 유지</small></span>
            </label>
            <label>
              <input type="radio" name="lifehub-backup-mode" checked={mode === 'replace'} onChange={() => changeMode('replace')} />
              <span><strong>전체 교체</strong><small>현재 기록을 백업 파일 내용으로 교체</small></span>
            </label>
          </fieldset>

          <div className="lifeHubBackupCounts">
            {VISIBLE_BACKUP_COLLECTIONS.map((key) => (
              <span key={key}>
                <small>{COLLECTION_LABELS[key]}</small>
                <strong>{plan.collections[key].result}</strong>
                <em>{plan.collections[key].added ? `+${plan.collections[key].added}` : '변화 없음'}</em>
              </span>
            ))}
          </div>
          {changedSingletonLabel(plan) ? (
            <p className="lifeHubBackupWarning">
              이 복원은 기록과 함께 {changedSingletonLabel(plan)}도 백업 내용으로 변경합니다.
            </p>
          ) : null}
          {mode === 'replace' ? <p className="lifeHubBackupWarning">백업에 없는 현재 기록은 삭제됩니다. 실행 전 자동으로 검증하고, 실패하면 기존 데이터로 되돌립니다.</p> : null}
          {owner !== plan.source.owner ? <p className="lifeHubBackupWarning">다른 계정 이름({plan.source.owner})으로 만든 백업이에요. 이 기기의 {owner} 데이터에 복원합니다.</p> : null}
          <button type="button" className="primary" onClick={restoreBackup} disabled={Boolean(busy)}>
            {busy === 'restore' ? '복원 중…' : mode === 'merge' ? '안전하게 합치기' : '전체 교체 확인'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
