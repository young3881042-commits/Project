import MemoNavIcon from '../MemoNavIcon.jsx';

function formatScheduleTime(value) {
  return value || '시간 미정';
}

function scheduleSecondaryText(item) {
  return item.memo || item.location || item.type || '';
}

function scheduleProgressText(doneCount, totalCount, fallbackLabel) {
  return totalCount ? `${doneCount}/${totalCount} 완료` : fallbackLabel;
}

function scheduleItemKey(item, index, prefix) {
  return item.id || `${prefix}-${item.date || 'date-none'}-${item.title || 'schedule'}-${index}`;
}

function ScheduleCheckRow({ item, onToggle, weekly = false }) {
  const secondary = scheduleSecondaryText(item);
  const timeLabel = weekly
    ? [item.weekday, formatScheduleTime(item.time)].filter(Boolean).join(' · ')
    : formatScheduleTime(item.time);

  return (
    <label className={`appHomeScheduleRow ${item.done ? 'done' : ''}`}>
      <input
        type="checkbox"
        checked={Boolean(item.done)}
        onChange={(event) => onToggle?.(item, event.target.checked)}
      />
      <span className="appHomeScheduleRowBody">
        <span>
          <time>{timeLabel}</time>
          <strong>{item.title || '제목 없는 일정'}</strong>
        </span>
        {secondary ? <small>{secondary}</small> : null}
      </span>
    </label>
  );
}

function EmptyScheduleState({ title, description }) {
  return (
    <div className="appHomeScheduleEmpty">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

function TodayScheduleCard({ appOverview, onScheduleToggle }) {
  const todayItems = appOverview.personalTodayItems || [];
  const todayDoneCount = todayItems.filter((item) => item.done).length;

  return (
    <section className="appHomeCard appHomeFlowCard" aria-label="오늘 일정">
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="calendar" />
          <strong>오늘 일정</strong>
        </span>
      </header>
      <div className="appHomeScheduleProgress">
        <span>{scheduleProgressText(todayDoneCount, todayItems.length, '오늘 일정 없음')}</span>
        <small>오늘 일정 달성률 {Number(appOverview.personalTodayProgress || 0)}%</small>
      </div>
      {todayItems.length ? (
        <div className="appHomeScheduleList">
          {todayItems.map((item, index) => (
            <ScheduleCheckRow
              key={scheduleItemKey(item, index, 'today')}
              item={item}
              onToggle={onScheduleToggle}
            />
          ))}
        </div>
      ) : (
        <EmptyScheduleState
          title="오늘 등록된 일정이 없어요."
          description="오늘은 편히 쉬어도 좋아요."
        />
      )}
    </section>
  );
}

function WeekScheduleCard({ appOverview, onScheduleToggle }) {
  const weekItems = appOverview.personalWeekItems || [];
  const weekDoneCount = weekItems.filter((item) => item.done).length;
  const weekGroups = weekItems.reduce((groups, item) => {
    const key = item.date || 'date-none';
    const current = groups.get(key) || {
      key,
      label: [item.weekday, item.dateLabel].filter(Boolean).join(' · ') || '날짜 미정',
      items: []
    };
    current.items.push(item);
    groups.set(key, current);
    return groups;
  }, new Map());

  return (
    <section className="appHomeCard appHomeWeekCard" aria-label="금주 일정">
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="calendar" />
          <strong>금주 일정</strong>
        </span>
      </header>
      <div className="appHomeScheduleProgress">
        <span>{scheduleProgressText(weekDoneCount, weekItems.length, '이번 주 일정 없음')}</span>
        <small>금주 일정 달성률 {Number(appOverview.personalWeekProgress || 0)}%</small>
      </div>
      {weekItems.length ? (
        <div className="appHomeWeekList">
          {Array.from(weekGroups.values()).map((group) => (
            <section key={group.key} className="appHomeWeekGroup">
              <h3>{group.label}</h3>
              <div className="appHomeScheduleList">
                {group.items.map((item, index) => (
                  <ScheduleCheckRow
                    key={scheduleItemKey(item, index, group.key)}
                    item={item}
                    onToggle={onScheduleToggle}
                    weekly
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyScheduleState
          title="이번 주 등록된 일정이 없어요."
          description="이번 주는 여유가 있어요. 천천히 쉬어가세요."
        />
      )}
    </section>
  );
}

function QuickMemoCard({ onChange, onSubmit, status, value }) {
  return (
    <section className="appHomeCard appHomeQuickMemoCard" aria-label="빠른 메모">
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="board" />
          <strong>빠른 메모</strong>
        </span>
      </header>
      <form className="appHomeQuickMemoForm" onSubmit={onSubmit}>
        <textarea
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder="지금 떠오른 생각이나 할 일을 적어두세요."
          rows={3}
        />
        <button type="submit">저장</button>
      </form>
      {status ? <p className="appHomeInlineStatus">{status}</p> : null}
    </section>
  );
}

function RecentMemoCard({ appOverview, navigate }) {
  const recentItems = appOverview.recentMemoItems?.personal || [];

  return (
    <section className="appHomeCard appHomeRecentCard" aria-label="최근 메모">
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="board" />
          <strong>최근 메모</strong>
        </span>
        <button type="button" onClick={() => navigate('/notes')}>전체</button>
      </header>
      {recentItems.length ? (
        <div className="appHomeMemoList">
          {recentItems.map((item) => (
            <button type="button" key={item.id} onClick={() => navigate(item.path || '/notes')}>
              <span>
                <strong>{item.title}</strong>
                <small>{item.summary}</small>
              </span>
              <MemoNavIcon type="chevronRight" />
            </button>
          ))}
        </div>
      ) : (
        <EmptyScheduleState
          title="최근 메모가 없어요."
          description="빠른 메모에 적으면 여기에 바로 보여요."
        />
      )}
    </section>
  );
}

export default function HomeScheduleCards({
  appOverview = {},
  navigate,
  onQuickMemoChange,
  onQuickMemoSubmit,
  onScheduleToggle,
  quickMemoStatus,
  quickMemoText
}) {
  return (
    <>
      <TodayScheduleCard
        appOverview={appOverview}
        onScheduleToggle={onScheduleToggle}
      />
      <QuickMemoCard
        onChange={onQuickMemoChange}
        onSubmit={onQuickMemoSubmit}
        status={quickMemoStatus}
        value={quickMemoText}
      />
      <RecentMemoCard appOverview={appOverview} navigate={navigate} />
      <WeekScheduleCard
        appOverview={appOverview}
        onScheduleToggle={onScheduleToggle}
      />
    </>
  );
}
