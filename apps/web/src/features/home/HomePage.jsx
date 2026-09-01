import { useMemo, useState } from 'react';
import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import HomeMonthCalendar from '../../components/home/HomeMonthCalendar.jsx';
import {
  buildMonthCalendar,
  clampDateToMonth,
  expandSchedulesForCalendar,
  shiftCalendarMonth,
  summarizeHomeCalendar,
  summarizeMonthFinances
} from '../../components/home/homeMonthCalendarModel.js';
import LifeHubPackIcon from '../../components/lifehub/LifeHubPackIcon.jsx';
import { Section } from '../../components/lifehub/LifeHubUi.jsx';
import { fullDateLabel } from '../../utils/lifeHubFormatters.js';
import DailyBriefingCard from '../automation/DailyBriefingCard.jsx';
import {
  HOME_ACTIVITY_PERIODS,
  buildHomeActivitySummary
} from './homeActivitySummary.js';

export function homeGreetingForHour(hour = new Date().getHours()) {
  if (hour < 6) return '고요한 밤이에요';
  if (hour < 12) return '좋은 아침이에요';
  if (hour < 18) return '좋은 오후예요';
  return '오늘도 수고했어요';
}

export default function HomePage({ model, navigate }) {
  const [calendarMonth, setCalendarMonth] = useState(() => model.today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(model.today);
  const [activityPeriod, setActivityPeriod] = useState('week');
  const calendar = useMemo(() => buildMonthCalendar(calendarMonth), [calendarMonth]);
  const calendarSchedules = useMemo(
    () => expandSchedulesForCalendar(model.schedules, calendar.dateKeys),
    [model.schedules, calendar.dateKeys]
  );
  const calendarSummaries = useMemo(() => summarizeHomeCalendar({
    dateKeys: calendar.dateKeys,
    schedules: calendarSchedules,
    budgetEntries: model.budgetEntries,
    notes: model.notes
  }), [calendar.dateKeys, calendarSchedules, model.budgetEntries, model.notes]);
  const monthFinances = useMemo(
    () => summarizeMonthFinances(calendarMonth, model.budgetEntries),
    [calendarMonth, model.budgetEntries]
  );
  const {
    periodMeta: activityPeriodMeta,
    range: activityRange,
    stats: activityStats
  } = useMemo(() => buildHomeActivitySummary({
    period: activityPeriod,
    today: model.today,
    schedules: model.schedules,
    budgetEntries: model.budgetEntries
  }), [activityPeriod, model.today, model.schedules, model.budgetEntries]);

  const changeCalendarMonth = (offset) => {
    const nextMonth = shiftCalendarMonth(calendarMonth, offset);
    setCalendarMonth(nextMonth);
    setSelectedDate((current) => clampDateToMonth(nextMonth, current));
  };

  const selectCalendarDate = (nextDate) => {
    const nextMonth = nextDate.slice(0, 7);
    if (nextMonth !== calendarMonth) setCalendarMonth(nextMonth);
    setSelectedDate(nextDate);
  };

  const returnCalendarToToday = () => {
    setCalendarMonth(model.today.slice(0, 7));
    setSelectedDate(model.today);
  };

  return (
    <div className="lifeHubPage lifeHubHomeSimplePage">
      <section className="lifeHubHomeGreeting">
        <div>
          <span>{fullDateLabel(model.today)}</span>
          <h2>{homeGreetingForHour()} <span aria-hidden="true">👋</span></h2>
          <p>오늘 일정과 생활 기록을 한눈에 확인하세요.</p>
        </div>
        <LifeHubPackIcon name="habit" />
      </section>

      <section className="orbitHomeCapture" aria-label="바로 기록하기">
        <strong>바로 남기기</strong>
        <div>
          <button type="button" onClick={() => navigate('/schedule?new=schedule')}><MemoNavIcon type="calendar" /><span>일정</span></button>
          <button type="button" onClick={() => navigate('/memo?new=memo')}><MemoNavIcon type="edit" /><span>메모</span></button>
          <button type="button" onClick={() => navigate('/finance?new=entry')}><MemoNavIcon type="chart" /><span>지출</span></button>
        </div>
      </section>

      <DailyBriefingCard model={model} navigate={navigate} />

      <HomeMonthCalendar
        calendar={calendar}
        budgetEntries={model.budgetEntries}
        navigate={navigate}
        monthFinances={monthFinances}
        onChangeMonth={changeCalendarMonth}
        onSelectDate={selectCalendarDate}
        onToday={returnCalendarToToday}
        selectedDate={selectedDate}
        summaries={calendarSummaries}
        today={model.today}
      />

      <Section
        title={`${activityPeriodMeta.title} 활동 요약`}
        eyebrow={activityPeriod === 'all' ? '첫 기록부터 오늘까지' : `${activityRange.start.replaceAll('-', '.')} - ${activityRange.end.replaceAll('-', '.')}`}
        className="lifeHubWeeklySummary"
      >
        <div className="lifeHubActivityPeriodTabs" role="tablist" aria-label="활동 요약 기간">
          {HOME_ACTIVITY_PERIODS.map((period) => (
            <button
              type="button"
              role="tab"
              key={period.value}
              className={activityPeriod === period.value ? 'active' : ''}
              aria-selected={activityPeriod === period.value}
              onClick={() => setActivityPeriod(period.value)}
            >
              {period.label}
            </button>
          ))}
        </div>
        <div className="lifeHubWeeklyStats">
          {activityStats.map((item) => (
            <button type="button" key={item.label} onClick={() => navigate(item.route)}>
              <MemoNavIcon type={item.icon} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
