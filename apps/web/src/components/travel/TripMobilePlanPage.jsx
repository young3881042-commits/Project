import { useEffect, useMemo, useState } from 'react';

const CATEGORY_LABELS = ['관광', '이동', '식사', '쇼핑', '휴식'];

const CATEGORY_CLASS = {
  관광: 'sight',
  이동: 'transport',
  식사: 'meal',
  쇼핑: 'shopping',
  휴식: 'rest'
};

function compactDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(`${value || ''}`);
  if (!match) return value || '';
  return `${match[2]}.${match[3]}`;
}

function fullDateRange(trip = {}) {
  const start = compactDate(trip.startDate);
  const end = compactDate(trip.endDate);
  if (start && end) return `${start} - ${end}`;
  return start || end || '날짜 미정';
}

function categoryClass(category) {
  return CATEGORY_CLASS[category] || CATEGORY_CLASS.관광;
}

function moneyText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return `${value || ''}`.trim();
}

function hasCost(cost = {}) {
  return Boolean(
    cost.passName ||
      cost.passCost ||
      moneyText(cost.includedByPass) ||
      cost.icOrCashExtra ||
      cost.transportTotal ||
      cost.ticket ||
      cost.food ||
      cost.shopping ||
      cost.memo
  );
}

function detailRows(rows) {
  return rows.filter((row) => moneyText(row.value));
}

function selectedDayKey(day) {
  return `${day?.day || ''}-${day?.date || ''}`;
}

export default function TripMobilePage({ plan, actions = null }) {
  const mobilePlan = plan?.tripMobilePlan;
  const days = Array.isArray(mobilePlan?.days) ? mobilePlan.days : [];
  const [activeDayKey, setActiveDayKey] = useState(() => selectedDayKey(days[0]));

  useEffect(() => {
    if (!days.length) return;
    if (!days.some((day) => selectedDayKey(day) === activeDayKey)) {
      setActiveDayKey(selectedDayKey(days[0]));
    }
  }, [activeDayKey, days]);

  const activeDay = useMemo(
    () => days.find((day) => selectedDayKey(day) === activeDayKey) || days[0],
    [activeDayKey, days]
  );

  if (!mobilePlan || !days.length) {
    return (
      <section className="ltTripMobileEmpty">
        <h1>{plan?.title || '여행 일정'}</h1>
        <p>모바일 카드형으로 보여줄 일정 데이터가 아직 없습니다.</p>
      </section>
    );
  }

  return (
    <div className="ltTripMobilePage">
      <TripHeaderCard trip={mobilePlan.trip} budget={mobilePlan.budget} passRecommendation={mobilePlan.passRecommendation} />
      {actions ? <div className="ltTripMobileActions">{actions}</div> : null}
      <DaySummaryCards summaries={mobilePlan.daySummaries} />
      <PassRecommendationBox recommendation={mobilePlan.passRecommendation} />
      <DayTabs days={days} activeDayKey={selectedDayKey(activeDay)} onChange={setActiveDayKey} />
      <TimelineList day={activeDay} />
      <TicketLinksBox links={mobilePlan.ticketLinks} />
    </div>
  );
}

export function TripHeaderCard({ trip = {}, budget = {}, passRecommendation = {} }) {
  return (
    <section className="ltTripHeaderCard">
      <div className="ltTripHeaderTop">
        <span className="ltTripEyebrow">Mobile itinerary</span>
        <h1>{trip.title || '여행 일정'}</h1>
        {trip.summary ? <p>{trip.summary}</p> : null}
      </div>
      <div className="ltTripInfoGrid" aria-label="여행 기본 정보">
        <div>
          <span>날짜</span>
          <strong>{fullDateRange(trip)}</strong>
        </div>
        <div>
          <span>숙소</span>
          <strong>{trip.hotel || '숙소 미정'}</strong>
        </div>
        <div>
          <span>인원</span>
          <strong>{trip.people || '인원 미정'}</strong>
        </div>
        <div>
          <span>전체 예상예산</span>
          <strong>{budget.perPersonEstimate || '확인 필요'}</strong>
        </div>
      </div>
      <div className="ltTripPassDigest">
        <span>추천 교통권</span>
        <strong>{passRecommendation.summary || '교통권 추천 정보 확인 필요'}</strong>
      </div>
    </section>
  );
}

export function DaySummaryCards({ summaries = [] }) {
  if (!summaries.length) return null;
  return (
    <section className="ltTripSection" aria-label="일자별 요약">
      <div className="ltTripSectionHeader">
        <h2>일자별 요약</h2>
        <span>한눈에 보기</span>
      </div>
      <div className="ltDaySummaryScroller">
        {summaries.map((summary) => (
          <article className="ltDaySummaryCard" key={`${summary.day}-${summary.date}`}>
            <div className="ltDaySummaryTitle">
              <span>{summary.day}일차</span>
              <strong>{summary.title}</strong>
            </div>
            <p>{summary.route}</p>
            <div className="ltDaySummaryMeta">
              <span>{summary.theme}</span>
              <span>{summary.estimatedCost}</span>
              <span>{summary.passSummary}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DayTabs({ days = [], activeDayKey, onChange }) {
  return (
    <nav className="ltDayTabs" aria-label="일차 선택">
      {days.map((day) => {
        const key = selectedDayKey(day);
        return (
          <button
            type="button"
            key={key}
            className={key === activeDayKey ? 'active' : ''}
            aria-selected={key === activeDayKey}
            onClick={() => onChange(key)}
          >
            <span>{day.day}일차</span>
            <small>{compactDate(day.date)}</small>
          </button>
        );
      })}
    </nav>
  );
}

export function TimelineList({ day = {} }) {
  const items = Array.isArray(day.items) ? day.items : [];
  return (
    <section className="ltTripSection ltTimelineSection" aria-label={`${day.day || ''}일차 타임라인`}>
      <div className="ltTripSectionHeader">
        <h2>{day.day ? `${day.day}일차` : '일정'} 타임라인</h2>
        <span>{compactDate(day.date)} · {day.title}</span>
      </div>
      <div className="ltTimelineList">
        {items.map((item, index) => (
          <TimelineItemCard item={item} index={index} key={item.id || `${day.day}-${index}`} />
        ))}
      </div>
    </section>
  );
}

export function TimelineItemCard({ item = {}, index = 0 }) {
  const category = CATEGORY_LABELS.includes(item.category) ? item.category : '관광';
  const timeLabel = item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : item.startTime || '시간 미정';
  const className = categoryClass(category);

  return (
    <article className={`ltTimelineItemCard ${className}`}>
      <div className="ltTimelineTime">
        <time>{timeLabel}</time>
        {item.durationText ? <small>{item.durationText}</small> : null}
      </div>
      <div className="ltTimelineCardBody">
        <div className="ltTimelineCardHead">
          <span className={`ltCategoryBadge ${className}`}>{category}</span>
          <span className="ltTimelineIndex">{String(index + 1).padStart(2, '0')}</span>
        </div>
        <h3>{item.title}</h3>
        {item.description ? <p>{item.description}</p> : null}
        {item.location ? <div className="ltTimelineLocation">{item.location}</div> : null}
        {item.transport ? <TransportRouteDetail transport={item.transport} /> : null}
        {item.meal ? <MealInfoBox meal={item.meal} /> : null}
        {hasCost(item.cost) ? <CostBreakdownBox cost={item.cost} /> : null}
        {Array.isArray(item.tips) && item.tips.length ? (
          <ul className="ltTipList">
            {item.tips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export function TransportRouteDetail({ transport = {} }) {
  const route = Array.isArray(transport.route) ? transport.route : [];
  return (
    <details className="ltTripDetails ltTransportDetail">
      <summary>
        <span>상세 노선 보기</span>
        <strong>{transport.durationMinutes ? `${transport.durationMinutes}분` : '시간 확인'}</strong>
      </summary>
      <div className="ltTransportEndpoints">
        <span>{transport.from || '출발지 확인'}</span>
        <b>→</b>
        <span>{transport.to || '도착지 확인'}</span>
      </div>
      <ol className="ltTransportRouteSteps">
        {route.map((step, index) => (
          <li key={`${step.line}-${step.board}-${step.alight}-${index}`}>
            <strong>{step.line}</strong>
            <span>{step.direction}</span>
            <div>
              <b>{step.board}</b>
              <em>탑승</em>
              <b>{step.alight}</b>
              <em>하차</em>
            </div>
            {step.transfer ? <p>환승: {step.transfer}</p> : null}
            {step.walkText ? <p>도보: {step.walkText}</p> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

export function MealInfoBox({ meal = {} }) {
  return (
    <div className="ltMealInfoBox">
      <div>
        <span>{meal.type || '식사'}</span>
        <strong>{meal.restaurant || '식당 확인'}</strong>
      </div>
      {meal.recommendedMenu ? <p><b>추천 메뉴</b>{meal.recommendedMenu}</p> : null}
      {meal.expectedCost ? <p><b>예상 비용</b>{meal.expectedCost}</p> : null}
      {meal.note ? <small>{meal.note}</small> : null}
    </div>
  );
}

export function CostBreakdownBox({ cost = {} }) {
  const rows = detailRows([
    { label: '교통권/결제', value: cost.passName },
    { label: '패스비', value: cost.passCost },
    { label: '패스 포함 구간', value: cost.includedByPass },
    { label: 'IC/현금 추가', value: cost.icOrCashExtra },
    { label: '총 교통비', value: cost.transportTotal },
    { label: '입장권', value: cost.ticket },
    { label: '식비', value: cost.food },
    { label: '쇼핑', value: cost.shopping },
    { label: '메모', value: cost.memo }
  ]);

  return (
    <details className="ltTripDetails ltCostBreakdown">
      <summary>
        <span>비용 보기</span>
        <strong>{cost.transportTotal || cost.ticket || cost.food || cost.shopping || cost.memo || '상세'}</strong>
      </summary>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{moneyText(row.value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function PassRecommendationBox({ recommendation = {} }) {
  const byDate = Array.isArray(recommendation.byDate) ? recommendation.byDate : [];
  const notRecommended = Array.isArray(recommendation.notRecommended) ? recommendation.notRecommended : [];
  if (!recommendation.summary && !byDate.length && !notRecommended.length) return null;

  return (
    <section className="ltTripSection ltPassRecommendationBox">
      <div className="ltTripSectionHeader">
        <h2>교통권 추천</h2>
        <span>패스/IC 구분</span>
      </div>
      {recommendation.summary ? <p className="ltPassSummary">{recommendation.summary}</p> : null}
      <div className="ltPassDateList">
        {byDate.map((entry) => (
          <article key={entry.date}>
            <span>{compactDate(entry.date)}</span>
            <strong>{entry.recommendation}</strong>
            <p>{entry.reason}</p>
          </article>
        ))}
      </div>
      {notRecommended.length ? (
        <div className="ltPassNotRecommended">
          <strong>이번 동선에서 비추천</strong>
          {notRecommended.map((entry) => (
            <p key={entry.name}><b>{entry.name}</b>{entry.reason}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function TicketLinksBox({ links = [] }) {
  if (!Array.isArray(links) || !links.length) return null;
  return (
    <section className="ltTripSection ltTicketLinksBox" aria-label="교통권 및 입장권 링크">
      <div className="ltTripSectionHeader">
        <h2>구매·비교 링크</h2>
        <span>공식 확인</span>
      </div>
      <div className="ltTicketLinkList">
        {links.map((link) => (
          <a href={link.url} target="_blank" rel="noreferrer" key={`${link.name}-${link.url}`}>
            <div>
              <span>{link.type}</span>
              <strong>{link.name}</strong>
              {link.note ? <p>{link.note}</p> : null}
            </div>
            <em>{link.price || '가격 확인'}</em>
          </a>
        ))}
      </div>
    </section>
  );
}
