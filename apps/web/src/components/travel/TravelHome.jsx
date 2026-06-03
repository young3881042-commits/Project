import { useState } from 'react';
import {
  QUICK_ACTIONS,
  QUICK_RECOMMENDATIONS,
  QUICK_SEARCH_TERMS,
  SERVICE_CATEGORIES
} from './TravelHomeData.js';

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

function ServiceIcon({ type }) {
  const paths = {
    route: (
      <>
        <circle cx="6" cy="18" r="2.4"></circle>
        <circle cx="18" cy="6" r="2.4"></circle>
        <path d="M8.4 18H12a4 4 0 0 0 0-8h-.4a4 4 0 0 1 0-8H15"></path>
      </>
    ),
    guide: (
      <>
        <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z"></path>
        <circle cx="12" cy="10" r="2.6"></circle>
      </>
    ),
    hidden: (
      <>
        <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z"></path>
        <circle cx="12" cy="10" r="2.6"></circle>
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
    family: (
      <>
        <circle cx="9" cy="7" r="3"></circle>
        <circle cx="17" cy="8" r="2.4"></circle>
        <path d="M3 21a6 6 0 0 1 12 0"></path>
        <path d="M13.8 15.5A5 5 0 0 1 21 21"></path>
      </>
    ),
    camera: (
      <>
        <path d="M4 8h4l2-3h4l2 3h4v11H4z"></path>
        <circle cx="12" cy="14" r="3.4"></circle>
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"></path>
        <path d="M9 3v15"></path>
        <path d="M15 6v15"></path>
      </>
    ),
    transit: (
      <>
        <path d="M6 4h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"></path>
        <path d="M8 18l-2 3"></path>
        <path d="M16 18l2 3"></path>
        <path d="M4 10h16"></path>
        <circle cx="8" cy="14" r="1"></circle>
        <circle cx="16" cy="14" r="1"></circle>
      </>
    )
  };

  return (
    <span className="ltServiceIcon" aria-hidden="true">
      <Icon size={22}>{paths[type] || paths.route}</Icon>
    </span>
  );
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

function TravelHomeHeader({ navigate }) {
  return (
    <header className="ltTravelStartHeader">
      <div>
        <h1>여행</h1>
        <p>나만의 여행을 쉽고 즐겁게 계획해보세요.</p>
      </div>
      <button type="button" aria-label="저장 코스" onClick={() => navigate('/plans')}>
        <TravelQuickIcon type="calendar" />
      </button>
    </header>
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

function TravelAiTripCard({ navigate }) {
  return (
    <section className="ltTravelAiTripCard" aria-label="AI Trip">
      <div>
        <span className="ltEyebrow">AI Trip</span>
        <h2>여행 준비를 한 화면에서</h2>
        <p>다가오는 여행을 확인하고, 장소 찾기와 코스 만들기를 바로 시작하세요.</p>
      </div>
      <TravelHeroVisual compact />
      <button type="button" className="ltSecondaryButton" onClick={() => navigate('/destinations')}>
        장소 찾기
        <Icon size={16}>
          <path d="m9 6 6 6-6 6"></path>
        </Icon>
      </button>
    </section>
  );
}

export function TravelQuickActions({ navigate }) {
  return (
    <section className="ltTravelQuickActions" aria-label="여행 빠른 실행">
      {QUICK_ACTIONS.map((action) => (
        <button type="button" key={action.title} onClick={() => navigate(action.path)}>
          <TravelQuickIcon type={action.icon} />
          <span>{action.title}</span>
        </button>
      ))}
    </section>
  );
}

function HeroSearch({ query, setQuery, navigate }) {
  const submit = (event) => {
    event.preventDefault();
    const keyword = query.trim();
    navigate(keyword ? `/destinations?query=${encodeURIComponent(keyword)}` : '/destinations');
  };

  return (
    <form className="ltHeroSearch" onSubmit={submit}>
      <label>
        <span>어떤 여행을 찾고 있나요?</span>
        <div className="ltHeroSearchInput">
          <Icon>
            <circle cx="11" cy="11" r="7"></circle>
            <path d="m20 20-3.5-3.5"></path>
          </Icon>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="예: 제주 가족 여행, 도쿄 맛집, 교토 산책"
          />
          <button type="submit">찾기</button>
        </div>
      </label>
      <div className="ltHeroFilters" aria-label="인기 검색">
        <span>인기 검색</span>
        {QUICK_SEARCH_TERMS.map((term) => (
          <button
            type="button"
            key={term}
            onClick={() => navigate(`/destinations?query=${encodeURIComponent(term)}`)}
          >
            {term}
          </button>
        ))}
      </div>
    </form>
  );
}

function PurposeRail({ navigate }) {
  return (
    <section className="ltPurposeRail" aria-label="추천 목적">
      <div>
        <span>빠른 추천</span>
        <button type="button" onClick={() => navigate('/destinations')}>전체 보기</button>
      </div>
      <div className="ltPurposeChips">
        {QUICK_RECOMMENDATIONS.map((purpose) => (
          <button
            key={purpose.title}
            type="button"
            onClick={() => navigate(`/destinations?query=${encodeURIComponent(purpose.query)}`)}
          >
            <TravelQuickIcon type={purpose.icon} />
            <span>{purpose.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ServiceCategoryGrid({ navigate }) {
  return (
    <section className="ltServiceSection" aria-label="서비스 카테고리">
      <div className="ltSectionHeader compact">
        <div>
          <span className="ltSectionEyebrow">추천 카테고리</span>
          <h2>취향에 맞는 장소를 빠르게 좁히세요</h2>
          <p>테마를 고르면 장소 목록과 코스 만들기로 바로 이어집니다.</p>
        </div>
      </div>
      <div className="ltServiceGrid">
        {SERVICE_CATEGORIES.map((service) => (
          <button
            key={service.title}
            type="button"
            className="ltServiceCard"
            onClick={() => navigate(`/destinations?query=${encodeURIComponent(service.query)}`)}
          >
            <ServiceIcon type={service.icon} />
            <strong>{service.title}</strong>
            <span>{service.detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function TravelHome({ navigate, plansLoading, ddayPlan }) {
  const [query, setQuery] = useState('');

  return (
    <main className="ltPage ltHomePage ltTravelStartPage">
      <TravelHomeHeader navigate={navigate} />
      <TravelDdayCard loading={plansLoading} plan={ddayPlan} navigate={navigate} />
      <TravelAiTripCard navigate={navigate} />
      <TravelQuickActions navigate={navigate} />

      <section className="ltTravelSearchPanel" aria-label="여행 검색">
        <div>
          <span className="ltSectionEyebrow">빠른 검색</span>
        </div>
        <HeroSearch query={query} setQuery={setQuery} navigate={navigate} />
      </section>

      <PurposeRail navigate={navigate} />
      <ServiceCategoryGrid navigate={navigate} />
    </main>
  );
}
