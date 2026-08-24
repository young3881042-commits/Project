import { useEffect, useId, useMemo, useRef, useState } from 'react';
import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import { formatNumber } from '../../utils/lifeHubFormatters.js';
import {
  createFinanceShare,
  financeShareCsv,
  financeSharePeriodForMonth,
  parseFinanceShare,
  planFinanceShareImport,
  serializeFinanceShare
} from './financeShare.js';
import {
  readFinanceShareDocument,
  shareFinanceDocument
} from './financeShareDocuments.js';

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

function money(value) {
  return `${formatNumber(value)}원`;
}

function todayFileKey(today) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))
    ? today
    : new Date().toISOString().slice(0, 10);
}

function periodLabel(period) {
  if (!period.startDate) return '전체 기간';
  if (period.startDate.slice(0, 7) === period.endDate.slice(0, 7)
      && period.startDate.endsWith('-01')) {
    const month = period.startDate.slice(0, 7);
    if (financeSharePeriodForMonth(month).endDate === period.endDate) {
      return `${month} 월간`;
    }
  }
  return `${period.startDate} ~ ${period.endDate}`;
}

function errorText(error, fallback) {
  if (error?.cancelled || error?.code === 'cancelled') return '';
  if (error?.code === 'INVALID_PRODUCT') return 'Orbit 가계부 공유 파일이 아니에요.';
  if (error?.code === 'UNSUPPORTED_FUTURE_VERSION') return '더 최신 Orbit에서 만든 파일이에요. 앱을 업데이트해주세요.';
  return String(error?.message || fallback);
}

export default function FinanceSharePanel({ entries = [], today, onImport }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const inputRef = useRef(null);
  const monthPeriod = useMemo(() => financeSharePeriodForMonth(String(today || '').slice(0, 7)), [today]);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('month');
  const [startDate, setStartDate] = useState(monthPeriod.startDate);
  const [endDate, setEndDate] = useState(monthPeriod.endDate);
  const [includeMemo, setIncludeMemo] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState(null);

  const selectedPeriod = scope === 'all'
    ? { startDate: null, endDate: null }
    : scope === 'custom'
      ? { startDate, endDate }
      : monthPeriod;
  const selectedEntries = useMemo(() => entries.filter((entry) => (
    !selectedPeriod.startDate
    || (entry.date >= selectedPeriod.startDate && entry.date <= selectedPeriod.endDate)
  )), [entries, selectedPeriod.endDate, selectedPeriod.startDate]);
  const selectedTotals = useMemo(() => selectedEntries.reduce((summary, entry) => {
    summary[entry.type === 'deposit' ? 'income' : 'expense'] += Number(entry.amount) || 0;
    return summary;
  }, { income: 0, expense: 0 }), [selectedEntries]);
  const importPlan = useMemo(() => {
    if (!snapshot) return null;
    try {
      return planFinanceShareImport(entries, snapshot);
    } catch {
      return null;
    }
  }, [entries, snapshot]);

  useEffect(() => {
    setStartDate(monthPeriod.startDate);
    setEndDate(monthPeriod.endDate);
  }, [monthPeriod.endDate, monthPeriod.startDate]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
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
  }, [open]);

  const showManager = () => {
    setOpen(true);
    setMessage('');
    setError('');
  };

  const share = async (format) => {
    if (busy) return;
    setBusy(format);
    setMessage('');
    setError('');
    try {
      if (!selectedEntries.length) throw new Error('선택한 기간에 보낼 거래가 없어요.');
      const shareSnapshot = createFinanceShare({
        entries,
        ...selectedPeriod,
        includeMemo
      });
      const isCsv = format === 'csv';
      const result = await shareFinanceDocument({
        fileName: `Orbit-finance-${todayFileKey(today)}.${isCsv ? 'csv' : 'json'}`,
        mimeType: isCsv ? 'text/csv' : 'application/json',
        content: isCsv ? financeShareCsv(shareSnapshot) : serializeFinanceShare(shareSnapshot)
      });
      setMessage(result.mode === 'download'
        ? '가계부 파일을 저장했어요. 파일 앱에서 Bluetooth 등으로 보낼 수 있어요.'
        : '시스템 공유 창을 열었어요. Bluetooth나 원하는 앱을 선택하세요.');
    } catch (shareError) {
      const nextError = errorText(shareError, '가계부 파일을 공유하지 못했어요.');
      if (nextError) setError(nextError);
    } finally {
      setBusy('');
    }
  };

  const selectImport = () => {
    if (!busy) inputRef.current?.click();
  };

  const readImport = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    setBusy('read');
    setMessage('');
    setError('');
    try {
      const parsed = parseFinanceShare(await readFinanceShareDocument(file));
      setSnapshot(parsed);
      setMessage('가져오기 전에 새 거래와 중복 거래를 확인해주세요.');
    } catch (readError) {
      setSnapshot(null);
      setError(errorText(readError, '가계부 파일을 읽지 못했어요.'));
    } finally {
      setBusy('');
    }
  };

  const confirmImport = async () => {
    if (!importPlan || busy || !importPlan.added.length) return;
    setBusy('import');
    setMessage('');
    setError('');
    try {
      const result = await Promise.resolve(onImport?.(importPlan));
      if (!result?.saved) throw new Error(result?.message || '가계부에 거래를 추가하지 못했어요.');
      const imported = Number(result.imported) || importPlan.added.length;
      setSnapshot(null);
      setMessage(`새 거래 ${formatNumber(imported)}건을 가계부에 추가했어요.`);
    } catch (importError) {
      setError(errorText(importError, '가계부 파일을 가져오지 못했어요.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={readImport} />
      <section className="lifeHubFinanceShareSummary" aria-labelledby="financeShareSummaryTitle">
        <span><MemoNavIcon type="mail" /></span>
        <div>
          <strong id="financeShareSummaryTitle">가계부 파일 보내기</strong>
          <small>이번 달 사본을 Bluetooth·퀵쉐어·메신저로 전달</small>
        </div>
        <button type="button" onClick={showManager}>보내기·가져오기</button>
      </section>

      {open ? (
        <div className="lifeHubFinanceShareBackdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section
            ref={dialogRef}
            className="lifeHubFinanceShareSheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy={Boolean(busy)}
          >
            <header>
              <div>
                <span>한 번 보내는 가계부 사본</span>
                <h2 id={titleId}>가계부 파일 보내기·가져오기</h2>
                <p id={descriptionId}>이후 기록은 자동 동기화되지 않으며, 받은 사람에게 파일 사본이 남습니다.</p>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="가계부 파일 화면 닫기">
                <MemoNavIcon type="close" />
              </button>
            </header>

            <div className="lifeHubFinanceShareBody">
              <section className="lifeHubFinanceShareBlock" aria-labelledby="financeShareSendTitle">
                <header>
                  <strong id="financeShareSendTitle">보낼 범위</strong>
                  <small>{selectedEntries.length}건 · 수입 {money(selectedTotals.income)} · 지출 {money(selectedTotals.expense)}</small>
                </header>
                <fieldset className="lifeHubFinanceShareScopes">
                  <legend className="lifeHubLiveRegion">가계부 공유 기간</legend>
                  {[
                    { value: 'month', label: '이번 달' },
                    { value: 'all', label: '전체' },
                    { value: 'custom', label: '기간 선택' }
                  ].map((option) => (
                    <label key={option.value} className={scope === option.value ? 'active' : ''}>
                      <input type="radio" name="finance-share-scope" value={option.value} checked={scope === option.value} onChange={() => setScope(option.value)} />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </fieldset>
                {scope === 'custom' ? (
                  <div className="lifeHubFinanceShareDates">
                    <label><span>시작일</span><input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                    <label><span>종료일</span><input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
                  </div>
                ) : null}
                <label className="lifeHubFinanceShareMemo">
                  <input type="checkbox" checked={includeMemo} onChange={(event) => setIncludeMemo(event.target.checked)} />
                  <span><strong>메모도 함께 보내기</strong><small>사용처나 개인 내용이 있을 수 있어 기본으로 제외해요.</small></span>
                </label>
                <p className="lifeHubFinanceSharePrivacy">카드 알림 ID, owner 값과 자동화 원본 데이터는 파일에 포함하지 않아요.</p>
                <div className="lifeHubFinanceShareActions">
                  <button type="button" className="primary" disabled={Boolean(busy) || !selectedEntries.length} onClick={() => share('json')}>
                    {busy === 'json' ? '준비 중…' : 'Orbit용 JSON 공유'}
                  </button>
                  <button type="button" disabled={Boolean(busy) || !selectedEntries.length} onClick={() => share('csv')}>
                    {busy === 'csv' ? '준비 중…' : '보기용 CSV 공유'}
                  </button>
                </div>
              </section>

              <section className="lifeHubFinanceShareBlock" aria-labelledby="financeShareImportTitle">
                <header>
                  <strong id="financeShareImportTitle">받은 파일 가져오기</strong>
                  <small>Orbit용 JSON만 가져올 수 있어요.</small>
                </header>
                <button type="button" className="lifeHubFinanceImportPicker" disabled={Boolean(busy)} onClick={selectImport}>
                  <MemoNavIcon type="file" /> {busy === 'read' ? '파일 확인 중…' : '가계부 JSON 선택'}
                </button>

                {importPlan ? (
                  <div className="lifeHubFinanceImportPreview" role="region" aria-label="가계부 가져오기 미리보기">
                    <header>
                      <strong>{importPlan.snapshot.count}건을 찾았어요</strong>
                      <button type="button" onClick={() => setSnapshot(null)}>닫기</button>
                    </header>
                    <p>{periodLabel(importPlan.snapshot.period)} · {new Date(importPlan.snapshot.exportedAt).toLocaleString('ko-KR')}</p>
                    <div>
                      <span><small>새 거래</small><strong>{importPlan.added.length}</strong></span>
                      <span><small>이미 있음</small><strong>{importPlan.duplicates}</strong></span>
                      <span><small>수입 합계</small><strong>{money(importPlan.totals.income)}</strong></span>
                      <span><small>지출 합계</small><strong>{money(importPlan.totals.expense)}</strong></span>
                    </div>
                    <p className="lifeHubFinanceSharePrivacy">현재 거래는 지우거나 덮어쓰지 않고 새 거래만 추가해요.{importPlan.snapshot.memoIncluded ? ' 이 파일에는 메모가 포함되어 있어요.' : ''}</p>
                    <button type="button" className="primary" disabled={Boolean(busy) || !importPlan.added.length} onClick={confirmImport}>
                      {busy === 'import'
                        ? '추가 중…'
                        : importPlan.added.length
                          ? `새 거래 ${importPlan.added.length}건 추가`
                          : '추가할 새 거래 없음'}
                    </button>
                  </div>
                ) : null}
              </section>

              {message ? <p className="lifeHubFinanceShareStatus success" role="status">{message}</p> : null}
              {error ? <p className="lifeHubFinanceShareStatus error" role="alert">{error}</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
