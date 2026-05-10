import { useEffect, useMemo, useState } from 'react';

const AUTH_KEY = 'codex-workspace-auth';

function commonsImage(fileName, width = 1200) {
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(fileName)}?width=${width}`;
}

const DEFAULT_IMAGES = [
  commonsImage('Gyeongbokgung Palace Main Gate.jpg'),
  commonsImage('Gamcheon Culture Village.jpg'),
  commonsImage('Seongsan Ilchulbong 01.jpg'),
  commonsImage('Bulguksa temple main building.jpg')
];

const DESTINATION_IMAGES = {
  'SEOUL-001': commonsImage('Gyeongbokgung Palace Main Gate.jpg'),
  'SEOUL-002': commonsImage('Bukchon Hanok Village 05.jpg'),
  'SEOUL-003': commonsImage('Cafe storefront in Seongsu-dong.jpg'),
  'SEOUL-004': commonsImage('Mercado Mangwon en Seúl.jpg'),
  'SEOUL-005': commonsImage('Yeouido, Seoul.jpg'),
  'SEOUL-006': commonsImage('N Seoul Tower a4.jpg'),
  'GYEONGJU-001': commonsImage('Bulguksa temple main building.jpg'),
  'GYEONGJU-002': commonsImage('Donggung Palace and Wolji Pond in Gyeongju.jpg'),
  'GYEONGJU-003': commonsImage('Cheomseongdae, Gyeongju.jpg'),
  'GYEONGJU-004': commonsImage('Street in Gyeongju.jpg'),
  'GYEONGJU-005': commonsImage('Bomun Lake.jpg'),
  'GYEONGJU-006': commonsImage('Gyochon Village 1.jpg'),
  'BUSAN-001': commonsImage('Gamcheon Culture Village.jpg'),
  'BUSAN-002': commonsImage('Haeundae beach in Busan.jpg'),
  'BUSAN-003': commonsImage('Gwangalli Beach in Busan.jpg'),
  'BUSAN-004': commonsImage('Gukje Market.jpg'),
  'BUSAN-005': commonsImage('Seomyeon Street.jpg'),
  'BUSAN-006': commonsImage('Taejongdae in Busan.jpg'),
  'JEJU-001': commonsImage('Seongsan Ilchulbong 01.jpg'),
  'JEJU-002': commonsImage('Udo, Jeju Province, South Korea 01.jpg'),
  'JEJU-003': commonsImage('Hyeop-jae Beach.jpg'),
  'JEJU-004': commonsImage('Jeju dongmun market 1.JPG'),
  'JEJU-005': commonsImage('Aewol in Jeju island.jpg'),
  'JEJU-006': commonsImage('Bijarim forest, Jeju.jpg')
};

const FALLBACK_DESTINATIONS = [
  {
    id: 'seoul-seongsu',
    name: '성수 카페거리',
    region: '서울',
    summary: '로스터리, 편집숍, 갤러리를 짧은 도보 동선으로 묶는 서울 동부 상권입니다.',
    tags: ['카페', '커플', '사진'],
    category: '카페',
    rating: 4.8,
    reviewCount: 91,
    liveVisitors: 91,
    imageUrl: DESTINATION_IMAGES['SEOUL-003']
  },
  {
    id: 'busan-yeongdo',
    name: '감천문화마을',
    region: '부산',
    summary: '계단식 마을 풍경과 전망 포인트를 함께 보는 부산 대표 촬영 코스입니다.',
    tags: ['사진', '가족', '커플'],
    category: '마을',
    rating: 4.7,
    reviewCount: 89,
    liveVisitors: 89,
    imageUrl: DESTINATION_IMAGES['BUSAN-001']
  },
  {
    id: 'jeju-seogwipo',
    name: '성산일출봉',
    region: '제주',
    summary: '분화구 능선과 동부 해안 전망을 함께 보는 제주 핵심 자연 명소입니다.',
    tags: ['자연', '사진', '가족'],
    category: '오름',
    rating: 4.9,
    reviewCount: 97,
    liveVisitors: 97,
    imageUrl: DESTINATION_IMAGES['JEJU-001']
  }
];

const INTERESTS = ['맛집', '자연', '역사', '카페', '가족', '커플', '사진'];

async function localTripRequest(path, { method = 'GET', body } = {}) {
  const session = readStoredAuth();
  const headers = {
    Accept: 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {})
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error((await response.text()) || `HTTP ${response.status}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function pickString(...values) {
  const value = values.find((item) => item !== undefined && item !== null && `${item}`.trim());
  return value === undefined ? '' : `${value}`.trim();
}

function pickNumber(...values) {
  const value = values.find((item) => item !== undefined && item !== null && item !== '');
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readArray(payload, keys) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeTags(...values) {
  const tags = [];
  for (const value of values) {
    const parsed = parseMaybeJson(value);
    if (Array.isArray(parsed)) {
      tags.push(...parsed.map((tag) => `${tag}`.trim()).filter(Boolean));
      continue;
    }
    if (typeof parsed === 'string' && parsed.trim()) {
      tags.push(...parsed.split(/[,\n]/).map((tag) => tag.trim()).filter(Boolean));
    }
  }
  return Array.from(new Set(tags)).slice(0, 6);
}

function regionImage(region, index = 0) {
  const normalized = `${region || ''}`.toLowerCase();
  if (normalized.includes('서울') || normalized.includes('seoul')) return DEFAULT_IMAGES[0];
  if (normalized.includes('부산') || normalized.includes('busan')) return DEFAULT_IMAGES[1];
  if (normalized.includes('제주') || normalized.includes('jeju')) return DEFAULT_IMAGES[2];
  if (normalized.includes('경주') || normalized.includes('gyeongju')) return DEFAULT_IMAGES[3];
  return DEFAULT_IMAGES[index % DEFAULT_IMAGES.length];
}

function destinationImage(row, index = 0) {
  const explicit = pickString(row.imageUrl, row.image_url, row.photoUrl, row.thumbnailUrl);
  if (explicit) return explicit;
  const sourceRef = pickString(row.sourceRef, row.source_ref, row.code);
  if (sourceRef && DESTINATION_IMAGES[sourceRef]) return DESTINATION_IMAGES[sourceRef];
  return regionImage(pickString(row.region, row.regionName, row.region_name, row.area), index);
}

function normalizeDestination(raw, index = 0) {
  const row = raw || {};
  const tags = normalizeTags(row.styleTags, row.style_tags, row.primaryStyle, row.primary_style, row.tags, row.tagsJson, row.tags_json, row.keywords);
  const id = pickString(row.id, row.destinationId, row.destination_id, row.placeId, row.place_id, row.code) || `destination-${index}`;
  const popularityScore = pickNumber(row.popularityScore, row.popularity_score, row.reviewCount, row.review_count, row.reviews);
  const rawRating = pickNumber(row.rating, row.score, row.reviewScore, row.review_score);
  const rating = rawRating || (popularityScore ? Math.min(5, Math.max(3.8, popularityScore / 20)) : 0);
  const reviewCount = pickNumber(row.reviewCount, row.review_count, row.reviews, row.visitorCount, row.visitors, row.popularityScore, row.popularity_score, row.liveVisitors);
  return {
    id,
    name: pickString(row.name, row.title, row.destinationName, row.destination_name, row.placeName, row.place_name, row.districtName, row.district_name) || 'Untitled destination',
    region: pickString(row.region, row.regionName, row.region_name, row.area, row.districtName, row.district_name) || 'Local area',
    summary: pickString(row.summary, row.headline, row.description, row.overview, row.introduction) || 'Curated local stops, timing, and route ideas are ready for this area.',
    category: pickString(row.category, row.primaryStyle, row.primary_style, row.theme, row.destinationType, row.type) || 'Local',
    address: pickString(row.address, row.roadAddress, row.road_address),
    tags: tags.length ? tags : ['local', 'recommended'],
    rating,
    reviewCount,
    liveVisitors: reviewCount,
    occupancyRate: pickNumber(row.occupancyRate, row.congestionRate, row.busyRate),
    imageUrl: destinationImage(row, index)
  };
}

function normalizeDestinations(payload) {
  const rows = readArray(payload, ['destinations', 'items', 'content', 'results', 'places']);
  return rows.map(normalizeDestination);
}

function normalizeItineraryItem(raw, index = 0) {
  if (typeof raw === 'string') {
    return { time: '', title: raw, place: '', note: '', tags: [] };
  }
  const item = raw || {};
  return {
    time: pickString(item.time, item.timeSlot, item.time_slot, item.startTime, item.hour),
    title: pickString(item.title, item.name, item.destinationName, item.destination_name, item.activity) || `Stop ${index + 1}`,
    place: pickString(item.place, item.location, item.region, item.address),
    note: pickString(item.note, item.notes, item.description, item.reason),
    tags: normalizeTags(item.tags, item.keywords, item.primaryStyle)
  };
}

function normalizeItinerary(raw) {
  const parsed = parseMaybeJson(raw);
  const source = Array.isArray(parsed)
    ? parsed
    : readArray(parsed, ['items', 'days', 'itinerary', 'dailyPlans', 'daily_itinerary', 'schedule']);

  if (!source || !source.length) {
    return [];
  }

  const hasDayContainers = source.some((entry) => entry && typeof entry === 'object' && (entry.items || entry.activities || entry.stops || entry.schedule));
  if (hasDayContainers) {
    return source.map((day, index) => ({
      day: pickNumber(day.day, day.dayNumber, day.day_number) || index + 1,
      title: pickString(day.title, day.summary) || `Day ${index + 1}`,
      items: readArray(day, ['items', 'activities', 'stops', 'schedule']).map(normalizeItineraryItem)
    }));
  }

  const grouped = new Map();
  source.forEach((item, index) => {
    const row = item || {};
    const day = pickNumber(row.day, row.dayNumber, row.day_number) || 1;
    if (!grouped.has(day)) {
      grouped.set(day, []);
    }
    grouped.get(day).push(normalizeItineraryItem(row, index));
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, items]) => ({
      day,
      title: `Day ${day}`,
      items
    }));
}

function normalizePlan(raw, index = 0) {
  const plan = raw?.plan || raw?.travelPlan || raw || {};
  const itinerary = normalizeItinerary(plan.itinerary || plan.days || plan.dailyPlans || plan.daily_itinerary || plan.schedule || plan.items);
  const id = pickString(plan.id, plan.planId, plan.plan_id);
  const destinationValue = typeof plan.destination === 'string' ? plan.destination : '';
  const destinationName = pickString(plan.destinationName, plan.destination_name, plan.destination?.name, destinationValue);
  const title = pickString(plan.title, plan.name) || (destinationName ? `${destinationName} trip` : `Travel plan ${index + 1}`);
  return {
    id,
    key: id || `plan-${index}`,
    title,
    destinationName: destinationName || 'Selected destination',
    destinationRegion: pickString(plan.destinationRegion, plan.region, plan.destination?.region),
    summary: pickString(plan.summary, plan.description, plan.overview) || 'Day-by-day local route generated for the selected travel style.',
    startDate: pickString(plan.startDate, plan.start_date),
    days: pickNumber(plan.daysCount, plan.durationDays, plan.duration_days, plan.days) || Math.max(itinerary.length, 1),
    travelers: pickString(plan.travelers, plan.party, plan.travelerType, plan.traveler_type) || 'Flexible',
    pace: pickString(plan.pace, plan.travelPace) || 'Balanced',
    interests: normalizeTags(plan.interests, plan.tags),
    status: pickString(plan.status) || 'Ready',
    createdAt: pickString(plan.createdAt, plan.created_at),
    itinerary
  };
}

function normalizePlans(payload) {
  const rows = readArray(payload, ['plans', 'travelPlans', 'items', 'content', 'results']);
  return rows.map(normalizePlan);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatDate(value) {
  if (!value) return 'Flexible dates';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildRegionStats(destinations) {
  const grouped = new Map();
  destinations.forEach((destination) => {
    const region = destination.region || 'Local area';
    const current = grouped.get(region) || { ratingSum: 0, ratingCount: 0, reviewCount: 0, popularity: 0 };
    const rating = Number(destination.rating || 0);
    if (rating > 0) {
      current.ratingSum += rating;
      current.ratingCount += 1;
    }
    current.reviewCount += Number(destination.reviewCount || destination.liveVisitors || 0);
    current.popularity += Number(destination.liveVisitors || destination.reviewCount || 0);
    grouped.set(region, current);
  });

  return Array.from(grouped.entries()).reduce((acc, [region, value]) => {
    acc[region] = {
      rating: value.ratingCount ? value.ratingSum / value.ratingCount : 0,
      reviewCount: value.reviewCount,
      popularity: value.popularity
    };
    return acc;
  }, {});
}

function statsForPlan(plan, regionStats) {
  const tokens = [plan.destinationRegion, plan.destinationName]
    .join(' ')
    .split(/[·,/]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const matched = tokens.map((token) => regionStats[token]).filter(Boolean);
  if (!matched.length) {
    return { rating: 0, reviewCount: 0, popularity: 0 };
  }
  return {
    rating: matched.reduce((sum, item) => sum + item.rating, 0) / matched.length,
    reviewCount: matched.reduce((sum, item) => sum + item.reviewCount, 0),
    popularity: matched.reduce((sum, item) => sum + item.popularity, 0)
  };
}

function sortPlans(plans, regionStats, sortMode) {
  return plans
    .map((plan) => ({ plan, stats: statsForPlan(plan, regionStats) }))
    .sort((left, right) => {
      if (sortMode === 'rating') {
        return right.stats.rating - left.stats.rating || right.stats.reviewCount - left.stats.reviewCount;
      }
      if (sortMode === 'reviews') {
        return right.stats.reviewCount - left.stats.reviewCount || right.stats.rating - left.stats.rating;
      }
      if (sortMode === 'latest') {
        return new Date(right.plan.createdAt || 0) - new Date(left.plan.createdAt || 0);
      }
      return (right.stats.rating * 1000 + right.stats.reviewCount)
        - (left.stats.rating * 1000 + left.stats.reviewCount);
    });
}

function routeClick(event, to, navigate) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
    return;
  }
  event.preventDefault();
  navigate(to);
}

function useDestinations() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await localTripRequest('/api/destinations');
      const normalized = normalizeDestinations(payload);
      setDestinations(normalized.length ? normalized : FALLBACK_DESTINATIONS);
      setUsingFallback(!normalized.length);
    } catch (loadError) {
      setError(loadError.message);
      setDestinations(FALLBACK_DESTINATIONS);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  return { destinations, loading, error, usingFallback, reload: load };
}

function usePlans(limit) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await localTripRequest('/api/travel-plans');
      const normalized = normalizePlans(payload);
      setPlans(limit ? normalized.slice(0, limit) : normalized);
    } catch (loadError) {
      setError(loadError.message);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, [limit]);

  return { plans, loading, error, reload: load };
}

function LocalTripNav({ path, navigate }) {
  const items = [
    { label: 'Destinations', to: '/destinations' },
    { label: 'Planner', to: '/planner' },
    { label: 'Plans', to: '/plans' }
  ];

  return (
    <header className="ltNav">
      <div className="ltNavInner">
        <a className="ltBrand" href="/" onClick={(event) => routeClick(event, '/', navigate)}>
          <strong>LT</strong>
          <span>LocalTrip AI</span>
        </a>
        <nav className="ltNavLinks" aria-label="LocalTrip navigation">
          {items.map((item) => (
            <a
              key={item.to}
              href={item.to}
              className={path === item.to || (item.to !== '/' && path.startsWith(`${item.to}/`)) ? 'active' : ''}
              onClick={(event) => routeClick(event, item.to, navigate)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a className="ltNavAction" href="/planner" onClick={(event) => routeClick(event, '/planner', navigate)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Plan
        </a>
      </div>
    </header>
  );
}

function DestinationCard({ destination, compact = false, navigate }) {
  return (
    <article className={`ltDestinationCard ${compact ? 'compact' : ''}`}>
      <div className="ltDestinationPhoto" style={{ backgroundImage: `url("${destination.imageUrl}")` }}>
        <span>{destination.category}</span>
      </div>
      <div className="ltDestinationBody">
        <div className="ltCardTopline">
          <span>{destination.region}</span>
          {destination.rating ? (
            <strong style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#e11d48" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              {destination.rating.toFixed(1)}
              {destination.reviewCount ? <small>({formatNumber(destination.reviewCount)})</small> : null}
            </strong>
          ) : null}
        </div>
        <h3>{destination.name}</h3>
        <p>{destination.summary}</p>
        <div className="ltTagRow">
          {destination.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        {!compact ? (
          <button type="button" className="ltTextButton" onClick={() => navigate(`/planner?destination=${encodeURIComponent(destination.id)}`)} style={{ marginTop: '12px', color: '#0f766e', fontWeight: '700', cursor: 'pointer', border: 'none', background: 'none', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Plan this trip
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        ) : null}
      </div>
    </article>
  );
}

function PlanCard({ plan, navigate, stats }) {
  const content = (
    <>
      <div className="ltCardTopline">
        <span>{plan.destinationRegion || plan.destinationName}</span>
        <strong>{plan.status}</strong>
      </div>
      <h3>{plan.title}</h3>
      <p>{plan.summary}</p>
      <div className="ltPlanMeta">
        <span>{plan.days} days</span>
        <span>{formatDate(plan.startDate)}</span>
        <span>{plan.pace}</span>
        {stats?.rating ? <span>★ {stats.rating.toFixed(1)}</span> : null}
        {stats?.reviewCount ? <span>후기 {formatNumber(stats.reviewCount)}</span> : null}
      </div>
    </>
  );

  if (!plan.id) {
    return <article className="ltPlanCard">{content}</article>;
  }

  return (
    <a
      className="ltPlanCard"
      href={`/plans/${encodeURIComponent(plan.id)}`}
      onClick={(event) => routeClick(event, `/plans/${encodeURIComponent(plan.id)}`, navigate)}
    >
      {content}
    </a>
  );
}

function InlineNotice({ error, fallback }) {
  if (!error && !fallback) return null;
  return (
    <div className="ltInlineNotice">
      <strong>{fallback ? 'Preview data' : 'Request failed'}</strong>
      <span>{error || 'Connect the LocalTrip API to replace these sample destinations.'}</span>
    </div>
  );
}

function HomePage({ navigate }) {
  const { destinations, loading, error, usingFallback } = useDestinations();
  const { plans, loading: plansLoading } = usePlans(3);
  const topDestinations = destinations.slice(0, 3);
  const heroImages = topDestinations.length ? topDestinations : FALLBACK_DESTINATIONS;

  return (
    <main className="ltPage">
      <section className="ltHero">
        <div className="ltHeroCopy">
          <span className="ltEyebrow">LocalTrip AI</span>
          <h1>Experience Local Like Never Before.</h1>
          <p>Discover hidden gems, plan customized routes, and explore the best of local destinations with our AI-powered travel companion.</p>
          <div className="ltHeroActions">
            <a href="/planner" onClick={(event) => routeClick(event, '/planner', navigate)}>
              Get Started
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </a>
            <a href="/destinations" onClick={(event) => routeClick(event, '/destinations', navigate)}>Browse Places</a>
          </div>
        </div>
        <div className="ltHeroVisual">
          <div className="ltHeroImage main" style={{ backgroundImage: `url("${heroImages[0]?.imageUrl || DEFAULT_IMAGES[0]}")` }}>
            <span>{heroImages[0]?.region || 'Local'}</span>
          </div>
          <div className="ltHeroImage" style={{ backgroundImage: `url("${heroImages[1]?.imageUrl || DEFAULT_IMAGES[1]}")` }}>
            <span>{heroImages[1]?.region || 'Local'}</span>
          </div>
          <div className="ltHeroImage" style={{ backgroundImage: `url("${heroImages[2]?.imageUrl || DEFAULT_IMAGES[2]}")` }}>
            <span>{heroImages[2]?.region || 'Local'}</span>
          </div>
          <div className="ltHeroPanel">
            <div>
              <span>Active Destinations</span>
              <strong>{loading ? '-' : formatNumber(destinations.length)}</strong>
            </div>
            <div>
              <span>Saved Plans</span>
              <strong>{plansLoading ? '-' : formatNumber(plans.length)}</strong>
            </div>
            <div>
              <span>Top Region</span>
              <strong>{heroImages[0]?.region || '-'}</strong>
            </div>
          </div>
        </div>
      </section>

      <InlineNotice error={error} fallback={usingFallback} />

      <section className="ltSectionHeader">
        <div>
          <h2>Featured Destinations</h2>
          <p style={{ color: '#64748b', marginTop: '4px' }}>Hand-picked locations for your next adventure</p>
        </div>
        <a href="/destinations" onClick={(event) => routeClick(event, '/destinations', navigate)} className="ltTextButton" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          View all
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>
      </section>
      <div className="ltDestinationGrid">
        {topDestinations.map((destination) => (
          <DestinationCard key={destination.id} destination={destination} navigate={navigate} />
        ))}
      </div>

      <section className="ltSplitSection" style={{ marginTop: '80px', gap: '32px' }}>
        <div className="ltPlannerTeaser">
          <h2>Ready to plan your next journey?</h2>
          <p>Our AI analyzes thousands of data points to create the perfect itinerary tailored just for you.</p>
          <button type="button" onClick={() => navigate('/planner')}>
            Try AI Planner
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
              <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline>
            </svg>
          </button>
        </div>
        <div className="ltRecentPlans">
          <div className="ltSectionHeader compact">
            <div>
              <h2>Recent Itineraries</h2>
            </div>
          </div>
          {plans.length ? plans.map((plan) => <PlanCard key={plan.key} plan={plan} navigate={navigate} />) : (
            <div className="ltEmptyState">No travel plans yet. Be the first!</div>
          )}
        </div>
      </section>
    </main>
  );
}

function DestinationsPage({ navigate }) {
  const { destinations, loading, error, usingFallback, reload } = useDestinations();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [tag, setTag] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const regions = useMemo(() => {
    const unique = new Set();
    destinations.forEach((destination) => {
      if (destination.region) unique.add(destination.region);
    });
    return ['all', ...Array.from(unique)];
  }, [destinations]);
  const tags = useMemo(() => {
    const unique = new Set();
    destinations.forEach((destination) => destination.tags.forEach((item) => unique.add(item)));
    return ['all', ...Array.from(unique).slice(0, 12)];
  }, [destinations]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return destinations.filter((destination) => {
      const matchesQuery = !keyword || [destination.name, destination.region, destination.summary, destination.category, ...destination.tags]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
      const matchesRegion = region === 'all' || destination.region === region;
      const matchesTag = tag === 'all' || destination.tags.includes(tag);
      return matchesQuery && matchesRegion && matchesTag;
    });
  }, [destinations, query, region, tag]);

  const syncMock = async () => {
    setSyncing(true);
    setSyncError('');
    try {
      await localTripRequest('/api/destinations/sync/mock', { method: 'POST' });
      await reload();
    } catch (syncFailure) {
      setSyncError(syncFailure.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main className="ltPage">
      <section className="ltPageTitle">
        <div>
          <span className="ltEyebrow">Destinations</span>
          <h1>Find a local fit</h1>
        </div>
        <button type="button" className="ltSecondaryButton" onClick={syncMock} disabled={syncing}>
          {syncing ? 'Syncing' : 'Sync mock data'}
        </button>
      </section>

      <InlineNotice error={error} fallback={usingFallback} />
      {syncError ? <div className="ltInlineNotice error"><strong>Sync failed</strong><span>{syncError}</span></div> : null}

      <section className="ltFilterBar">
        <label>
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역, 장소, 테마 검색" />
        </label>
        <div className="ltSegmented" aria-label="지역 필터">
          {regions.map((item) => (
            <button key={item} type="button" className={region === item ? 'active' : ''} onClick={() => setRegion(item)}>
              {item === 'all' ? '전체 지역' : item}
            </button>
          ))}
        </div>
        <div className="ltSegmented">
          {tags.map((item) => (
            <button key={item} type="button" className={tag === item ? 'active' : ''} onClick={() => setTag(item)}>
              {item === 'all' ? '전체 스타일' : item}
            </button>
          ))}
        </div>
      </section>

      {loading ? <div className="ltEmptyState">Loading destinations.</div> : null}
      {!loading && !filtered.length ? <div className="ltEmptyState">No destinations match the current filters.</div> : null}
      <div className="ltDestinationGrid">
        {filtered.map((destination) => (
          <DestinationCard key={destination.id} destination={destination} navigate={navigate} />
        ))}
      </div>
    </main>
  );
}

function PlannerPage({ path, navigate }) {
  const { destinations, error, usingFallback } = useDestinations();
  const params = new URLSearchParams(path.split('?')[1] || '');
  const initialDestination = params.get('destination') || '';
  const [selectedDestinationIds, setSelectedDestinationIds] = useState(initialDestination ? [initialDestination] : []);
  const [destSearch, setDestSearch] = useState('');
  const [showSuggestions, setShowDestSuggestions] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState('커플');
  const [transportType, setTransportType] = useState('대중교통');
  const [pace, setPace] = useState('보통');
  const [budget, setBudget] = useState('보통');
  const [exportFormat, setExportFormat] = useState('텍스트');
  const [selectedInterests, setSelectedInterests] = useState(['맛집', '역사']);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generatedPlan, setGeneratedPlan] = useState(null);

  useEffect(() => {
    if (initialDestination && !selectedDestinationIds.includes(initialDestination)) {
      setSelectedDestinationIds((current) => [...new Set([...current, initialDestination])]);
    }
  }, [initialDestination]);

  useEffect(() => {
    if (selectedDestinationIds.length === 0 && destinations.length > 0 && !initialDestination) {
      setSelectedDestinationIds([destinations[0].id]);
    }
  }, [destinations]);

  const toggleDestination = (id) => {
    setSelectedDestinationIds((current) => (
      current.includes(id)
        ? (current.length > 1 ? current.filter((item) => item !== id) : current)
        : [...current, id]
    ));
  };

  const filteredSuggestions = useMemo(() => {
    const query = destSearch.trim().toLowerCase();
    if (!query) return [];
    return destinations.filter(d => 
      (d.name.toLowerCase().includes(query) || d.region.toLowerCase().includes(query)) &&
      !selectedDestinationIds.includes(d.id)
    ).slice(0, 8);
  }, [destSearch, destinations, selectedDestinationIds]);

  const toggleInterest = (interest) => {
    setSelectedInterests((current) => (
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest]
    ));
  };

  const submit = async (event) => {
    event.preventDefault();
    setGenerating(true);
    setGenerateError('');
    setGeneratedPlan(null);

    const selectedDestObjects = destinations.filter(d => selectedDestinationIds.includes(d.id));
    const regions = [...new Set(selectedDestObjects.map(d => d.region))];

    const payload = {
      regions,
      travelStyle: selectedInterests,
      styles: selectedInterests,
      startDate: startDate || null,
      days: Number(days),
      transportType,
      travelerType: travelers,
      pace,
      budgetLevel: budget,
      exportFormat,
      memo: notes
    };
    try {
      const response = await localTripRequest('/api/travel-plans/generate', { method: 'POST', body: payload });
      const plan = normalizePlan(response);
      setGeneratedPlan(plan);
      if (plan.id) {
        navigate(`/plans/${encodeURIComponent(plan.id)}`);
      }
    } catch (submitError) {
      setGenerateError(submitError.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="ltPage">
      <section className="ltPageTitle">
        <div>
          <span className="ltEyebrow">Planner</span>
          <h1>Build a multi-stop route</h1>
        </div>
      </section>

      <InlineNotice error={error} fallback={usingFallback} />

      <section className="ltPlannerLayout">
        <form className="ltPlannerForm" onSubmit={submit}>
          <div className="ltAutocompleteGroup">
            <label>
              <span>Destinations Search</span>
              <div className="ltAutocompleteContainer">
                <input 
                  value={destSearch} 
                  onChange={(e) => {
                    setDestSearch(e.target.value);
                    setShowDestSuggestions(true);
                  }}
                  onFocus={() => setShowDestSuggestions(true)}
                  placeholder="지역 또는 장소 검색 (예: 경주, 서울, 제주...)" 
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="ltAutocompleteDropdown">
                    {filteredSuggestions.map(d => (
                      <button 
                        key={d.id} 
                        type="button" 
                        onClick={() => {
                          toggleDestination(d.id);
                          setDestSearch('');
                          setShowDestSuggestions(false);
                        }}
                      >
                        <strong>{d.name}</strong>
                        <span>{d.region}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <div className="ltSelectedTagRow">
              {destinations.filter(d => selectedDestinationIds.includes(d.id)).map(d => (
                <span key={d.id} className="ltSelectedTag">
                  {d.name} ({d.region})
                  <button type="button" onClick={() => toggleDestination(d.id)} aria-label="Remove">×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="ltFormGrid">
            <label>
              <span>Start date</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>
              <span>Days</span>
              <input type="number" min="1" max="10" value={days} onChange={(event) => setDays(event.target.value)} />
            </label>
          </div>
          <div className="ltFormGrid">
            <label>
              <span>Travelers</span>
              <select value={travelers} onChange={(event) => setTravelers(event.target.value)}>
                <option value="혼자">혼자</option>
                <option value="커플">커플</option>
                <option value="친구">친구</option>
                <option value="가족">가족</option>
              </select>
            </label>
            <label>
              <span>Pace</span>
              <select value={pace} onChange={(event) => setPace(event.target.value)}>
                <option value="여유">여유</option>
                <option value="보통">보통</option>
                <option value="촘촘">촘촘</option>
              </select>
            </label>
          </div>
          <div className="ltFormGrid">
            <label>
              <span>Transport</span>
              <select value={transportType} onChange={(event) => setTransportType(event.target.value)}>
                <option value="대중교통">대중교통</option>
                <option value="자동차">자동차</option>
                <option value="도보">도보</option>
              </select>
            </label>
            <label>
              <span>Export Format</span>
              <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}>
                <option value="텍스트">텍스트</option>
                <option value="엑셀">엑셀</option>
                <option value="PDF">PDF</option>
              </select>
            </label>
          </div>
          <label>
            <span>Budget</span>
            <select value={budget} onChange={(event) => setBudget(event.target.value)}>
              <option value="절약">절약</option>
              <option value="보통">보통</option>
              <option value="프리미엄">프리미엄</option>
            </select>
          </label>
          <div className="ltInterestGroup">
            <span>Interests</span>
            <div>
              {INTERESTS.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  className={selectedInterests.includes(interest) ? 'active' : ''}
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span>Notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Arrival time, mobility needs, must-see stops" />
          </label>
          {generateError ? <div className="ltInlineNotice error"><strong>Generation failed</strong><span>{generateError}</span></div> : null}
          <button type="submit" className="ltPrimaryButton" disabled={generating || selectedDestinationIds.length === 0}>
            {generating ? 'Generating' : 'Generate plan'}
          </button>
        </form>

        <aside className="ltPlannerPreview">
          <div className="ltSelectedSummary">
            <h3>Selected ({selectedDestinationIds.length})</h3>
            <div className="ltMiniDestList">
              {destinations.filter(d => selectedDestinationIds.includes(d.id)).map(d => (
                <div key={d.id} className="ltMiniDestCard">
                  <div className="ltMiniDestPhoto" style={{ backgroundImage: `url("${d.imageUrl}")` }} />
                  <div>
                    <strong>{d.name}</strong>
                    <span>{d.region}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {generatedPlan ? (
            <div className="ltGeneratedPreview">
              <h2>{generatedPlan.title}</h2>
              <ItineraryTimeline itinerary={generatedPlan.itinerary} />
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function PlansPage({ navigate }) {
  const { plans, loading, error, reload } = usePlans();
  const { destinations } = useDestinations();
  const [sortMode, setSortMode] = useState('recommended');
  const regionStats = useMemo(() => buildRegionStats(destinations), [destinations]);
  const sortedPlans = useMemo(() => sortPlans(plans, regionStats, sortMode), [plans, regionStats, sortMode]);

  return (
    <main className="ltPage">
      <section className="ltPageTitle">
        <div>
          <span className="ltEyebrow">Plans</span>
          <h1>Saved itineraries</h1>
        </div>
        <div className="ltPageActions">
          <div className="ltSegmented compact" aria-label="일정 정렬">
            <button type="button" className={sortMode === 'recommended' ? 'active' : ''} onClick={() => setSortMode('recommended')}>추천순</button>
            <button type="button" className={sortMode === 'rating' ? 'active' : ''} onClick={() => setSortMode('rating')}>평점순</button>
            <button type="button" className={sortMode === 'reviews' ? 'active' : ''} onClick={() => setSortMode('reviews')}>후기순</button>
            <button type="button" className={sortMode === 'latest' ? 'active' : ''} onClick={() => setSortMode('latest')}>최신순</button>
          </div>
          <button type="button" className="ltSecondaryButton" onClick={reload}>Refresh</button>
        </div>
      </section>

      {error ? <div className="ltInlineNotice error"><strong>Request failed</strong><span>{error}</span></div> : null}
      {loading ? <div className="ltEmptyState">Loading travel plans.</div> : null}
      {!loading && !plans.length ? <div className="ltEmptyState">No saved travel plans yet.</div> : null}
      <div className="ltPlansGrid">
        {sortedPlans.map(({ plan, stats }) => <PlanCard key={plan.key} plan={plan} stats={stats} navigate={navigate} />)}
      </div>
    </main>
  );
}

function ItineraryTimeline({ itinerary }) {
  if (!itinerary || !itinerary.length) {
    return (
      <div className="ltEmptyState" style={{ marginTop: '24px', padding: '60px' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>일정 상세 내역이 아직 생성되지 않았거나 불러올 수 없습니다.</p>
      </div>
    );
  }
  return (
    <div className="ltTimeline">
      {itinerary.map((day) => (
        <section className="ltTimelineDay" key={day.day}>
          <div className="ltTimelineDayHeader">
            <span>Day {day.day}</span>
            <h2>{day.title}</h2>
          </div>
          <div className="ltTimelineItems">
            {day.items.map((item, index) => (
              <article className="ltTimelineItem" key={`${day.day}-${item.title}-${index}`}>
                <time>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  {item.time || '유동적'}
                </time>
                <div className="ltTimelineItemContent">
                  <h3>{item.title}</h3>
                  {item.place ? (
                    <span className="ltTimelinePlace">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      {item.place}
                    </span>
                  ) : null}
                  {item.note ? <p className="ltTimelineNote">{item.note}</p> : null}
                  {item.tags && item.tags.length ? (
                    <div className="ltTagRow small">
                      {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PlanDetailPage({ planId, navigate }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await localTripRequest(`/api/travel-plans/${encodeURIComponent(planId)}`);
        if (!cancelled) {
          setPlan(normalizePlan(payload));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
          setPlan(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [planId]);

  return (
    <main className="ltPage">
      <div className="ltPageHeader">
        <button type="button" className="ltBackButton" onClick={() => navigate('/plans')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          목록으로 돌아가기
        </button>
      </div>

      {loading ? <div className="ltEmptyState" style={{ padding: '100px' }}>일정을 불러오는 중입니다...</div> : null}
      {error ? <div className="ltInlineNotice error"><strong>로드 실패</strong><span>{error}</span></div> : null}
      
      {plan ? (
        <div className="ltPlanDetailContainer">
          <section className="ltPlanHero">
            <div className="ltPlanHeroMain">
              <span className="ltEyebrow">{plan.destinationName}</span>
              <h1>{plan.title}</h1>
              <p>{plan.summary}</p>
            </div>
            <div className="ltPlanFacts">
              <div className="ltFactItem">
                <span>기간</span>
                <strong>{plan.days}일</strong>
              </div>
              <div className="ltFactItem">
                <span>출발일</span>
                <strong>{formatDate(plan.startDate)}</strong>
              </div>
              <div className="ltFactItem">
                <span>인원</span>
                <strong>{plan.travelers}</strong>
              </div>
              <div className="ltFactItem">
                <span>속도</span>
                <strong>{plan.pace}</strong>
              </div>
            </div>
          </section>
          
          <div className="ltSectionHeader" style={{ marginTop: '48px', marginBottom: '24px' }}>
            <h2>상세 일정</h2>
          </div>
          <ItineraryTimeline itinerary={plan.itinerary} />
        </div>
      ) : null}
    </main>
  );
}

function NotFoundPage({ navigate }) {
  return (
    <main className="ltPage">
      <section className="ltEmptyState large">
        <h1>Page not found</h1>
        <button type="button" className="ltPrimaryButton" onClick={() => navigate('/')}>Go home</button>
      </section>
    </main>
  );
}

export default function LocalTripApp({ path, navigate }) {
  useEffect(() => {
    document.title = 'LocalTrip AI';
  }, [path]);

  const normalizedPath = path || '/';
  const cleanPath = normalizedPath.split('?')[0];
  let page;
  if (cleanPath === '/') {
    page = <HomePage navigate={navigate} />;
  } else if (cleanPath === '/destinations') {
    page = <DestinationsPage navigate={navigate} />;
  } else if (cleanPath === '/planner') {
    page = <PlannerPage path={normalizedPath} navigate={navigate} />;
  } else if (cleanPath === '/plans') {
    page = <PlansPage navigate={navigate} />;
  } else if (cleanPath.startsWith('/plans/')) {
    page = <PlanDetailPage planId={decodeURIComponent(cleanPath.replace('/plans/', ''))} navigate={navigate} />;
  } else {
    page = <NotFoundPage navigate={navigate} />;
  }

  return (
    <div className="ltShell">
      <LocalTripNav path={cleanPath} navigate={navigate} />
      {page}
      <footer className="ltFooter">
        <span>LocalTrip AI</span>
        <span>Route planning for local travel</span>
      </footer>
    </div>
  );
}
