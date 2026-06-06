import { QUICK_ACTIONS } from './TravelHomeData.js';
import { OSAKA_KYOTO_COUPLE_PRESET } from './OsakaKyotoTripData.js';

function Icon({ children, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function formatDaysLabel(value) {
  const days = Number(value);
  return Number.isFinite(days) && days > 0 ? `${days}일` : '일정 미정';
}

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(`${value || ''}`.slice(0, 10));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateCompact(value) {
  const raw = `${value || ''}`.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw.replace(/-/g, '.') : '날짜 미정';
}

function dateDiffInDays(fromDate, toDate) {
  const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function dateKeyWithOffset(dateKey, offset = 0) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(`${dateKey || ''}`);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function travelDdayInfo(plan) {
  const startDate = parseDateOnly(plan?.startDate);
  if (!startDate) {
    return {
      label: 'D-Day',
      status: '날짜를 정해주세요',
      range: '날짜 미정',
      duration: formatDaysLabel(plan?.days)
    };
  }

  const today = new Date();
  const daysUntil = dateDiffInDays(today, startDate);
  const days = Number(plan?.days);
  const duration = Number.isFinite(days) && days > 0
    ? days === 1 ? '당일치기' : `${days - 1}박 ${days}일`
    : '일정 미정';
  const endDate = Number.isFinite(days) && days > 0
    ? dateKeyWithOffset(plan.startDate, days - 1)
    : '';

  return {
    label: daysUntil > 0 ? `D-${daysUntil}` : daysUntil === 0 ? 'D-Day' : `D+${Math.abs(daysUntil)}`,
    status: daysUntil > 0 ? '다가오는 여행' : daysUntil === 0 ? '오늘 출발' : '완료된 여행',
    range: [formatDateCompact(plan.startDate), endDate ? formatDateCompact(endDate) : ''].filter(Boolean).join(' - '),
    duration
  };
}

export function selectDdayPlan(plans = []) {
  const today = new Date();
  const datedPlans = plans
    .map((plan, index) => ({ plan, index, startDate: parseDateOnly(plan.startDate) }))
    .filter((item) => item.startDate);
  if (!datedPlans.length) return plans[0] || null;

  return datedPlans.sort((left, right) => {
    const leftDiff = dateDiffInDays(today, left.startDate);
    const rightDiff = dateDiffInDays(today, right.startDate);
    const leftPast = leftDiff < 0 ? 1 : 0;
    const rightPast = rightDiff < 0 ? 1 : 0;
    if (leftPast !== rightPast) return leftPast - rightPast;
    if (leftPast) return rightDiff - leftDiff;
    return leftDiff - rightDiff;
  })[0].plan;
}

function TravelQuickIcon({ type }) {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7"></circle>
        <path d="m20 20-3.5-3.5"></path>
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="18" r="2.4"></circle>
        <circle cx="18" cy="6" r="2.4"></circle>
        <path d="M8.4 18H12a4 4 0 0 0 0-8h-.4a4 4 0 0 1 0-8H15"></path>
      </>
    ),
    calendar: (
      <>
        <path d="M5 5h14v15H5z"></path>
        <path d="M8 3v4M16 3v4M5 10h14"></path>
      </>
    ),
    memo: (
      <>
        <path d="M5 4h14v16H5z"></path>
        <path d="M9 8h6M9 12h6M9 16h4"></path>
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14"></path>
        <path d="M5 12h14"></path>
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"></path>
      </>
    ),
    food: (
      <>
        <path d="M4 3v8"></path>
        <path d="M8 3v8"></path>
        <path d="M4 7h4"></path>
        <path d="M6 11v10"></path>
        <path d="M18 3v18"></path>
        <path d="M15 3c0 4 1 6 3 7"></path>
      </>
    ),
    camera: (
      <>
        <path d="M4 8h4l2-3h4l2 3h4v11H4z"></path>
        <circle cx="12" cy="14" r="3.4"></circle>
      </>
    ),
    history: (
      <>
        <path d="M4 20h16"></path>
        <path d="M6 20V9l6-4 6 4v11"></path>
        <path d="M9 20v-7h6v7"></path>
      </>
    )
  };

  return (
    <span className="ltTravelQuickIcon" aria-hidden="true">
      <Icon size={20}>{paths[type] || paths.route}</Icon>
    </span>
  );
}

function TravelHeroVisual({ compact = false }) {
  return (
    <div className={`ltTravelHeroVisual${compact ? ' compact' : ''}`} aria-hidden="true">
      <img src="/assets/travel-home-hero.png" alt="" />
    </div>
  );
}

export function TravelDdayCard({ loading, plan, navigate }) {
  if (loading) {
    return (
      <section className="ltTravelDdayCard loading" aria-label="여행 D-Day">
        <div>
          <span>여행 코스</span>
          <h1>여행 정보를 확인 중입니다</h1>
          <p>저장한 여행 코스를 불러오고 있어요.</p>
        </div>
      </section>
    );
  }

  if (!plan) {
    return (
      <section className="ltTravelDdayCard empty" aria-label="여행 D-Day">
        <div>
          <span>여행 코스</span>
          <h1>다가오는 여행이 없어요.</h1>
          <p>새 여행을 만들어보세요.</p>
          <button type="button" className="ltPrimaryButton" onClick={() => navigate('/planner')}>
            <TravelQuickIcon type="plus" />
            여행 만들기
          </button>
        </div>
        <TravelHeroVisual />
      </section>
    );
  }

  const dday = travelDdayInfo(plan);
  return (
    <section className="ltTravelDdayCard" aria-label="여행 D-Day">
      <div>
        <span>{dday.status}</span>
        <h1>{plan.title || plan.destinationName || '여행 코스'}</h1>
        <p>{dday.range}</p>
        <small>{dday.duration}</small>
      </div>
      <strong>{dday.label}</strong>
    </section>
  );
}

export function TravelQuickActions({ navigate, title = '' }) {
  const sectionId = title ? 'travelQuickMenuTitle' : undefined;

  return (
    <section
      className={`ltTravelQuickActions${title ? ' withTitle' : ''}`}
      aria-label={title ? undefined : '여행 빠른 실행'}
      aria-labelledby={sectionId}
    >
      {title ? (
        <div className="ltTravelQuickHeader">
          <h2 id={sectionId}>{title}</h2>
        </div>
      ) : null}
      <div className="ltTravelQuickGrid">
        {QUICK_ACTIONS.map((action) => (
          <button type="button" key={action.title} onClick={() => navigate(action.path)}>
            <TravelQuickIcon type={action.icon} />
            <span>{action.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TravelPresetCard({ navigate }) {
  const preset = OSAKA_KYOTO_COUPLE_PRESET;
  return (
    <section className="ltTravelPresetCard" aria-label="오사카 교토 여행 프리셋">
      <div className="ltTravelPresetCopy">
        <span>추천 프리셋</span>
        <h2>{preset.title}</h2>
        <p>{preset.subtitle}</p>
      </div>
      <div className="ltTravelPresetFacts">
        {preset.highlights.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <button type="button" className="ltPrimaryButton" onClick={() => navigate(`/planner?preset=${preset.id}`)}>
        <TravelQuickIcon type="route" />
        바로 채우기
      </button>
    </section>
  );
}

export default function TravelHome({ navigate, plansLoading = false, ddayPlan = null }) {
  return (
    <main className="ltPage ltHomePage ltTravelStartPage">
      <TravelDdayCard loading={plansLoading} plan={ddayPlan} navigate={navigate} />
      <TravelPresetCard navigate={navigate} />
      <TravelQuickActions navigate={navigate} title="빠른 메뉴" />
    </main>
  );
}
