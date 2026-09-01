import { useEffect, useRef } from 'react';
import MemoNavIcon from '../MemoNavIcon.jsx';
import { formatNumber, fullDateLabel } from '../../utils/lifeHubFormatters.js';
import { formatCalendarAmount, shiftCalendarMonth } from './homeMonthCalendarModel.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function shiftDate(date, offset) {
  const [year, month, day] = String(date).split('-').map(Number);
  const shifted = new Date(year, month - 1, day + offset);
  return [
    shifted.getFullYear(),
    String(shifted.getMonth() + 1).padStart(2, '0'),
    String(shifted.getDate()).padStart(2, '0')
  ].join('-');
}

function calendarCellLabel(cell, summary) {
  const parts = [fullDateLabel(cell.date)];
  if (summary.income) parts.push(`수입 ${formatNumber(summary.income)}원`);
  if (summary.expense) parts.push(`지출 ${formatNumber(summary.expense)}원`);
  if (summary.schedulePlanned) parts.push(`일정 ${summary.schedulePlanned}개 예정`);
  if (summary.scheduleIncomplete) parts.push(`일정 ${summary.scheduleIncomplete}개 미완료`);
  if (summary.scheduleDone) parts.push(`일정 ${summary.scheduleDone}개 완료`);
  if (summary.memoCount) parts.push('메모 ' + summary.memoCount + '개');
  return parts.join(', ');
}

function CalendarMarkers({ summary }) {
  const hasPlanned = summary.schedulePlanned > 0;
  const hasIncomplete = summary.scheduleIncomplete > 0;
  const hasDone = summary.scheduleDone > 0;
  const hasMemos = summary.memoCount > 0;
  return (
    <span className="homeMonthDayMarkers" aria-hidden="true">
      {summary.income ? <span className="income">+{formatCalendarAmount(summary.income)}</span> : null}
      {summary.expense ? <span className="expense">−{formatCalendarAmount(summary.expense)}</span> : null}
      {hasPlanned ? <span className="planned">예정</span> : null}
      {hasIncomplete ? <span className="incomplete">미완료</span> : null}
      {hasDone ? <span className="done">완료</span> : null}
      {hasMemos ? <span className="memo">메모{summary.memoCount}</span> : null}
    </span>
  );
}

function financeSourceLabel(entry) {
  if (entry?.origin?.kind !== 'card-notification') return '';
  if (entry.origin.source === 'kakao-pay') return '카카오페이';
  if (entry.origin.source === 'samsung-wallet') return '삼성페이';
  return '결제 알림';
}

function SelectedDateDetail({ budgetEntries, date, detailRef, summary, navigate, today }) {
  const activities = summary.activities.slice(0, 8);
  const financeEntries = (Array.isArray(budgetEntries) ? budgetEntries : [])
    .filter((entry) => entry?.date === date)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  const remainingActivities = summary.activities.slice(8);
  const memoItems = (summary.memoItems || []).slice(0, 4);
  const remainingMemos = Math.max(0, (summary.memoItems || []).length - memoItems.length);
  const hasRemainingSchedules = remainingActivities.some((activity) => activity.kind === 'schedule');
  const openActivity = (activity) => navigate(`/schedule?edit=${encodeURIComponent(activity.scheduleId || activity.id)}`);

  return (
    <section ref={detailRef} className="homeMonthSelectedDetail" aria-label="선택한 날짜 상세">
      <header>
        <div>
          <span>{date === today ? '오늘 · 선택됨' : '선택한 날짜'}</span>
          <h3 aria-live="polite">{fullDateLabel(date)}</h3>
        </div>
        <div className="homeMonthHeaderActions">
          <button type="button" onClick={() => navigate('/schedule?new=schedule&date=' + encodeURIComponent(date))}>일정 추가</button>
          <button type="button" onClick={() => navigate('/memo?new=memo')}>메모 작성</button>
        </div>
      </header>

      <div className="homeMonthMoneySummary">
        <button type="button" onClick={() => navigate(`/finance?date=${encodeURIComponent(date)}`)}>
          <span>수입 · {summary.incomeCount}건</span>
          <strong>+{formatNumber(summary.income)}원</strong>
        </button>
        <button type="button" onClick={() => navigate(`/finance?date=${encodeURIComponent(date)}`)}>
          <span>지출 · {summary.expenseCount}건</span>
          <strong>−{formatNumber(summary.expense)}원</strong>
        </button>
      </div>

      {financeEntries.length ? (
        <div className="homeMonthFinanceList" aria-label={`${date} 수입과 지출 내역`}>
          {financeEntries.map((entry) => {
            const sourceLabel = financeSourceLabel(entry);
            return (
              <div className="homeMonthFinanceRow" key={entry.id}>
                <span className={`homeMonthFinanceType ${entry.type}`}>
                  {entry.type === 'deposit' ? '수입' : '지출'}
                </span>
                <span className="homeMonthFinanceCopy">
                  <strong>{entry.category || '기타'}</strong>
                  <small>
                    {entry.memo || '기록 없음'}
                    {sourceLabel ? ` · ${sourceLabel}` : ''}
                  </small>
                </span>
                <em className={entry.type}>
                  {entry.type === 'deposit' ? '+' : '−'}{formatNumber(entry.amount)}원
                </em>
              </div>
            );
          })}
        </div>
      ) : null}

      {memoItems.length ? (
        <div className="homeMonthMemoList" aria-label={date + ' 작성 메모'}>
          {memoItems.map((note) => (
            <button type="button" key={note.id} onClick={() => navigate('/memo?edit=' + encodeURIComponent(note.id))}>
              <span><MemoNavIcon type="edit" /></span>
              <span><strong>{note.title}</strong><small>이날 작성한 메모</small></span>
              <em>열기</em>
            </button>
          ))}
          {remainingMemos ? <small>그 외 메모 {remainingMemos}개가 있어요.</small> : null}
        </div>
      ) : null}

      {activities.length ? (
        <div className="homeMonthActivityList">
          {activities.map((activity) => (
            <button type="button" key={`${activity.kind}:${activity.id}`} onClick={() => openActivity(activity)}>
              <span className="homeMonthActivityIcon">
                <MemoNavIcon type="calendar" />
              </span>
              <span>
                <strong>{activity.title}</strong>
                <small>{activity.time || '종일'}</small>
              </span>
              <em className={activity.status === '완료' ? 'done' : activity.status === '미완료' ? 'incomplete' : 'planned'}>({activity.status})</em>
            </button>
          ))}
          {remainingActivities.length ? (
            <div className="homeMonthRemainingActions">
              <span>그 외 {remainingActivities.length}개 기록이 있어요.</span>
              {hasRemainingSchedules ? <button type="button" onClick={() => navigate(`/schedule?date=${encodeURIComponent(date)}`)}>일정 전체 보기</button> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="homeMonthEmptyDetail">이 날짜에 등록한 일정은 없어요.</p>
      )}
    </section>
  );
}

export default function HomeMonthCalendar({
  calendar,
  budgetEntries = [],
  monthFinances = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 },
  navigate,
  onChangeMonth,
  onSelectDate,
  onToday,
  selectedDate,
  summaries,
  today
}) {
  const gridRef = useRef(null);
  const detailRef = useRef(null);
  const pendingKeyboardFocus = useRef('');
  const previousMonth = shiftCalendarMonth(calendar.month, -1);
  const nextMonth = shiftCalendarMonth(calendar.month, 1);
  const weeks = Array.from({ length: calendar.cells.length / 7 }, (_, index) => calendar.cells.slice(index * 7, index * 7 + 7));
  const selectedSummary = summaries[selectedDate] || {
    income: 0,
    expense: 0,
    incomeCount: 0,
    expenseCount: 0,
    activities: []
  };

  useEffect(() => {
    if (!pendingKeyboardFocus.current) return;
    const target = gridRef.current?.querySelector(`[data-date="${pendingKeyboardFocus.current}"]`);
    if (!target) return;
    target.focus();
    pendingKeyboardFocus.current = '';
  }, [calendar.month, selectedDate]);

  const selectDate = (date, { revealDetail = false } = {}) => {
    onSelectDate(date);
    if (!revealDetail) return;
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const moveWithKeyboard = (event, cell) => {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let offset = offsets[event.key];
    if (event.key === 'Home') offset = -cell.weekday;
    if (event.key === 'End') offset = 6 - cell.weekday;
    if (offset === undefined) return;
    event.preventDefault();
    const nextDate = shiftDate(cell.date, offset);
    pendingKeyboardFocus.current = nextDate;
    selectDate(nextDate);
  };

  return (
    <section className="homeMonthCalendarCard" aria-labelledby="homeMonthCalendarTitle">
      <header className="homeMonthCalendarHeader">
        <div>
          <span>생활 월간 캘린더</span>
          <h2 id="homeMonthCalendarTitle" aria-live="polite">{calendar.label}</h2>
        </div>
        <nav aria-label="달력 월 이동">
          <button type="button" onClick={() => onChangeMonth(-1)} aria-label={`${previousMonth.replace('-', '년 ')}월로 이동`}>
            <MemoNavIcon type="chevronLeft" />
          </button>
          <button type="button" className="today" onClick={onToday}>오늘</button>
          <button type="button" onClick={() => onChangeMonth(1)} aria-label={`${nextMonth.replace('-', '년 ')}월로 이동`}>
            <MemoNavIcon type="chevronRight" />
          </button>
        </nav>
      </header>

      <div className="homeMonthFinanceTotals" role="group" aria-label={`${calendar.label} 수입과 지출 합계`}>
        <article className="income">
          <span>월 수입 · {monthFinances.incomeCount}건</span>
          <strong>+{formatNumber(monthFinances.income)}원</strong>
        </article>
        <article className="expense">
          <span>월 지출 · {monthFinances.expenseCount}건</span>
          <strong>−{formatNumber(monthFinances.expense)}원</strong>
        </article>
      </div>

      <p className="homeMonthCalendarLegend">
        <span><strong>+</strong> 수입 · <strong>−</strong> 지출</span>
        <span><strong>예정·미완료·완료</strong> 일정 상태</span>
      </p>
      <div ref={gridRef} className="homeMonthGrid" role="grid" aria-label={`${calendar.label} 생활 기록`} aria-colcount="7" aria-rowcount={weeks.length + 1}>
        <div className="homeMonthWeekdays" role="row">
          {WEEKDAYS.map((weekday) => <span role="columnheader" key={weekday}>{weekday}</span>)}
        </div>
        {weeks.map((week) => (
          <div className="homeMonthWeek" role="row" key={week[0].date}>
            {week.map((cell) => {
              const summary = summaries[cell.date] || {
                income: 0,
                expense: 0,
                schedulePlanned: 0,
                scheduleIncomplete: 0,
                scheduleDone: 0
              };
              const selected = cell.date === selectedDate;
              const isToday = cell.date === today;
              return (
                <button
                  type="button"
                  role="gridcell"
                  key={cell.date}
                  data-date={cell.date}
                  className={`homeMonthDay${cell.inMonth ? '' : ' outside'}${selected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                  aria-label={calendarCellLabel(cell, summary)}
                  aria-selected={selected}
                  aria-current={isToday ? 'date' : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectDate(cell.date, { revealDetail: true })}
                  onKeyDown={(event) => moveWithKeyboard(event, cell)}
                >
                  <time dateTime={cell.date}>{cell.day}</time>
                  <CalendarMarkers summary={summary} />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <SelectedDateDetail budgetEntries={budgetEntries} date={selectedDate} detailRef={detailRef} summary={selectedSummary} navigate={navigate} today={today} />
    </section>
  );
}
