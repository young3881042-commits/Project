import { useEffect, useId, useMemo, useRef, useState } from 'react';
import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import { formatNumber } from '../../utils/lifeHubFormatters.js';
import {
  RECURRING_PAYMENT_CATEGORIES,
  recurringPaymentOccurrences
} from './recurringPayments.js';

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';
const BILLING_DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));

function money(value) {
  return `${formatNumber(value)}원`;
}

function dayLabel(value) {
  return value === 'last' ? '말일' : `${Number(value) || 1}일`;
}

function dateDayLabel(value) {
  return value ? `${Number(value.slice(-2))}일` : '날짜 없음';
}

function emptyDraft(today, cardImportActive) {
  return {
    id: '',
    name: '',
    amount: '',
    billingDay: '1',
    category: '구독',
    startMonth: String(today || '').slice(0, 7),
    endMonth: '',
    autoPost: !cardImportActive,
    active: true,
    createdAt: ''
  };
}

export default function RecurringPaymentsPanel({
  budgetEntries = [],
  cardImportActive = false,
  onDelete,
  onPost,
  onSave,
  rules = [],
  today
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => emptyDraft(today, cardImportActive));
  const [error, setError] = useState('');
  const month = String(today || '').slice(0, 7);
  const occurrences = useMemo(() => recurringPaymentOccurrences(rules, budgetEntries, {
    month,
    today
  }), [budgetEntries, month, rules, today]);
  const occurrenceByRule = useMemo(() => new Map(
    occurrences.map((occurrence) => [occurrence.rule.id, occurrence])
  ), [occurrences]);
  const forecast = occurrences.reduce((sum, occurrence) => sum + occurrence.rule.amount, 0);
  const posted = occurrences.filter((occurrence) => occurrence.status === 'posted');
  const actual = posted.reduce((sum, occurrence) => sum + (Number(occurrence.postedEntry?.amount) || 0), 0);
  const next = occurrences.find((occurrence) => occurrence.status !== 'posted') || null;

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

  const resetEditor = () => {
    setEditing(false);
    setDraft(emptyDraft(today, cardImportActive));
    setError('');
  };

  const openManager = () => {
    setOpen(true);
    setError('');
    if (!rules.length) {
      setDraft(emptyDraft(today, cardImportActive));
      setEditing(true);
    }
  };

  const startAdd = () => {
    setDraft(emptyDraft(today, cardImportActive));
    setError('');
    setEditing(true);
  };

  const startEdit = (rule) => {
    setDraft({
      id: rule.id,
      name: rule.name,
      amount: String(rule.amount),
      billingDay: rule.billingDay,
      category: rule.category,
      startMonth: rule.startMonth,
      endMonth: rule.endMonth || '',
      autoPost: rule.autoPost,
      active: rule.active,
      createdAt: rule.createdAt
    });
    setError('');
    setEditing(true);
  };

  const submit = (event) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError('결제 이름을 입력해주세요.');
      return;
    }
    if (!(Number(draft.amount) > 0)) {
      setError('0원보다 큰 금액을 입력해주세요.');
      return;
    }
    if (draft.endMonth && draft.endMonth < draft.startMonth) {
      setError('종료월은 시작월보다 빠를 수 없어요.');
      return;
    }
    const saved = onSave?.({
      ...draft,
      updatedAt: new Date().toISOString()
    });
    if (saved === false) {
      setError('정기 결제를 저장하지 못했어요.');
      return;
    }
    resetEditor();
  };

  const remove = (rule) => {
    if (!window.confirm(`${rule.name} 정기 결제를 삭제할까요? 이미 기록된 가계부 내역은 유지돼요.`)) return;
    if (onDelete?.(rule) !== false && draft.id === rule.id) resetEditor();
  };

  const nextLabel = next
    ? next.status === 'due'
      ? `${dateDayLabel(next.dueDate)} · 반영 대기`
      : `${dateDayLabel(next.dueDate)} · ${next.rule.name}`
    : occurrences.length
      ? '이번 달 모두 기록됨'
      : '등록된 예정 없음';

  return (
    <>
      <section className="lifeHubRecurringSummary" aria-labelledby="recurringPaymentsSummaryTitle">
        <span className="lifeHubRecurringIcon"><MemoNavIcon type="refresh" /></span>
        <div>
          <span id="recurringPaymentsSummaryTitle">정기 결제 · 이번 달 예정</span>
          <strong>{money(forecast)}</strong>
          <small>{occurrences.length}건 중 {posted.length}건 기록 · 실제 {money(actual)}</small>
          <em>{nextLabel}</em>
        </div>
        <button type="button" onClick={openManager}>관리</button>
      </section>

      {open ? (
        <div
          className="lifeHubRecurringBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            ref={dialogRef}
            className="lifeHubRecurringSheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <header>
              <div>
                <span>매달 나갈 돈을 미리 확인해요</span>
                <h2 id={titleId}>정기 결제 관리</h2>
                <p id={descriptionId}>예정 금액과 실제 가계부 기록은 따로 보여드려요.</p>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="정기 결제 관리 닫기">
                <MemoNavIcon type="close" />
              </button>
            </header>

            <div className="lifeHubRecurringSheetBody">
              <div className="lifeHubRecurringMonthStatus">
                <div><span>이번 달 예정</span><strong>{money(forecast)}</strong></div>
                <div><span>가계부 기록</span><strong>{posted.length}/{occurrences.length}건</strong></div>
              </div>

              {editing ? (
                <form className="lifeHubRecurringForm" onSubmit={submit}>
                  <header>
                    <strong>{draft.id ? '정기 결제 수정' : '정기 결제 추가'}</strong>
                    <button type="button" onClick={resetEditor}>취소</button>
                  </header>
                  <label>
                    <span>이름</span>
                    <input
                      autoFocus
                      value={draft.name}
                      maxLength={80}
                      onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                      placeholder="예: 넷플릭스, 월세"
                    />
                  </label>
                  <div className="lifeHubRecurringTwoCol">
                    <label>
                      <span>매달 금액</span>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={draft.amount}
                        onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
                        placeholder="0"
                      />
                    </label>
                    <label>
                      <span>결제일</span>
                      <select value={draft.billingDay} onChange={(event) => setDraft((current) => ({ ...current, billingDay: event.target.value }))}>
                        {BILLING_DAYS.map((day) => <option key={day} value={day}>매달 {day}일</option>)}
                        <option value="last">매달 말일</option>
                      </select>
                    </label>
                  </div>
                  <div className="lifeHubRecurringTwoCol">
                    <label>
                      <span>카테고리</span>
                      <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
                        {RECURRING_PAYMENT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>시작월</span>
                      <input type="month" value={draft.startMonth} onChange={(event) => setDraft((current) => ({ ...current, startMonth: event.target.value }))} />
                    </label>
                  </div>
                  <label className="lifeHubRecurringToggle">
                    <input
                      type="checkbox"
                      checked={draft.autoPost}
                      onChange={(event) => setDraft((current) => ({ ...current, autoPost: event.target.checked }))}
                    />
                    <span><strong>결제일에 가계부 자동 반영</strong><small>앱을 다음에 열어도 이번 달 누락분을 한 번만 기록해요.</small></span>
                  </label>
                  {cardImportActive && draft.autoPost ? (
                    <p className="lifeHubRecurringWarning" role="status">결제 알림 자동 가져오기도 켜져 있어 같은 결제가 두 번 기록될 수 있어요. 둘 중 하나만 자동으로 쓰는 걸 권장해요.</p>
                  ) : null}
                  <details>
                    <summary>종료월·사용 상태</summary>
                    <div className="lifeHubRecurringAdvanced">
                      <label><span>종료월</span><input type="month" min={draft.startMonth} value={draft.endMonth} onChange={(event) => setDraft((current) => ({ ...current, endMonth: event.target.value }))} /></label>
                      <label className="lifeHubRecurringToggle compact">
                        <input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} />
                        <span><strong>이 규칙 사용</strong><small>끄면 삭제하지 않고 잠시 멈춰요.</small></span>
                      </label>
                    </div>
                  </details>
                  <small className="lifeHubRecurringGuide">29·30·31일은 해당 날짜가 없는 달에 자동으로 말일 처리합니다.</small>
                  {error ? <p className="lifeHubRecurringError" role="alert">{error}</p> : null}
                  <button type="submit" className="primary">{draft.id ? '수정 저장' : '정기 결제 저장'}</button>
                </form>
              ) : null}

              <div className="lifeHubRecurringListHeader">
                <strong>등록한 결제</strong>
                {!editing ? <button type="button" onClick={startAdd}><MemoNavIcon type="plus" /> 추가</button> : null}
              </div>

              {rules.length ? (
                <div className="lifeHubRecurringList">
                  {rules.map((rule) => {
                    const occurrence = occurrenceByRule.get(rule.id);
                    const status = !rule.active
                      ? '멈춤'
                      : occurrence?.status === 'posted'
                        ? '기록됨'
                        : occurrence?.status === 'due'
                          ? '반영 대기'
                          : occurrence
                            ? '예정'
                            : rule.endMonth && rule.endMonth < month
                              ? '종료'
                              : '기간 밖';
                    return (
                      <article key={rule.id} className={!rule.active ? 'isPaused' : ''}>
                        <span className={`lifeHubRecurringDay ${occurrence?.status || ''}`}>{dayLabel(rule.billingDay)}</span>
                        <div>
                          <header><strong>{rule.name}</strong><em>{status}</em></header>
                          <p>{rule.category} · {money(rule.amount)}{rule.autoPost ? ' · 자동 반영' : ''}</p>
                          <small>{rule.startMonth}부터{rule.endMonth ? ` ${rule.endMonth}까지` : ''}</small>
                        </div>
                        <div className="lifeHubRecurringRowActions">
                          {occurrence && occurrence.status !== 'posted' ? (
                            <button type="button" className="post" onClick={() => onPost?.(rule)}>이번 달 반영</button>
                          ) : null}
                          <button type="button" onClick={() => startEdit(rule)}>수정</button>
                          <button type="button" className="delete" onClick={() => remove(rule)}>삭제</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : editing ? null : (
                <div className="lifeHubRecurringEmpty">
                  <MemoNavIcon type="calendar" />
                  <strong>등록한 정기 결제가 없어요</strong>
                  <p>월세·통신비·구독처럼 반복되는 지출을 미리 모아보세요.</p>
                  <button type="button" onClick={startAdd}>첫 정기 결제 추가</button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
