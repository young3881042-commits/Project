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
  'SEOUL-007': commonsImage('20240601 144028 Dongdaemun Design Plaza, Seoul 08.jpg'),
  'SEOUL-008': commonsImage('KOCIS Cheonggyecheon (stream) in Seoul (7085882037).jpg'),
  'GYEONGJU-001': commonsImage('Bulguksa temple main building.jpg'),
  'GYEONGJU-002': commonsImage('Donggung Palace and Wolji Pond in Gyeongju.jpg'),
  'GYEONGJU-003': commonsImage('Cheomseongdae, Gyeongju.jpg'),
  'GYEONGJU-004': commonsImage('Street in Gyeongju.jpg'),
  'GYEONGJU-005': commonsImage('Bomun Lake.jpg'),
  'GYEONGJU-006': commonsImage('Gyochon Village 1.jpg'),
  'GYEONGJU-007': commonsImage('Woljeonggyo Bridge.jpg'),
  'GYEONGJU-008': commonsImage('Daereungwon Tomb Complex.jpg'),
  'BUSAN-001': commonsImage('Gamcheon culture village.jpg'),
  'BUSAN-002': commonsImage('Haeundae Beach Busan (45698772312).jpg'),
  'BUSAN-003': commonsImage('Gwangalli Beach in Busan.jpg'),
  'BUSAN-004': commonsImage('Gukje Market.jpg'),
  'BUSAN-005': commonsImage('Seomyeon Street.jpg'),
  'BUSAN-006': commonsImage('Taejongdae in Busan.jpg'),
  'BUSAN-007': commonsImage('Jagalchi Market Busan.jpg'),
  'BUSAN-008': commonsImage('Oryukdo Skywalk.jpg'),
  'JEJU-001': commonsImage('Seongsan Ilchulbong 01.jpg'),
  'JEJU-002': commonsImage('Udo, Jeju Province, South Korea 01.jpg'),
  'JEJU-003': commonsImage('Hyeop-jae Beach.jpg'),
  'JEJU-004': commonsImage('Jeju dongmun market 1.JPG'),
  'JEJU-005': commonsImage('Aewol in Jeju island.jpg'),
  'JEJU-006': commonsImage('Bijarim forest, Jeju.jpg'),
  'JEJU-007': commonsImage('Hallasan Mountain.jpg'),
  'JEJU-008': commonsImage('Eco-Pond, Camellia Hill, Jeju (생태연못, 제주 카멜리아힐) - panoramio.jpg'),
  SEOKGURAM: commonsImage('Front view of Seokguram from front chamber.jpg'),
  GYEONGJU_MUSEUM: commonsImage('Gyeongju National Museum.jpg'),
  GYEONGJU_WORLD: commonsImage('Entrance of Gyeongju World and Draken.jpg'),
  YANGDONG: commonsImage('Yangdong Village 02.jpg'),
  HUINNYEOUL: commonsImage('Stairway at Huinnyeoul Culture Village in Busan, South Korea.jpg'),
  DONGBAEKSEOM: commonsImage('Dongbaekseom, Busan (2).jpg'),
  DADAEPO: commonsImage('Dadaepo Beach, Busan, Korea.jpg'),
  SONGJEONG: commonsImage('Songjeong Beach.jpg'),
  CHANGDEOKGUNG: commonsImage('Exterior view of Seongjeonggak with blue sky at Changdeokgung Palace in Seoul.jpg'),
  GWANGJANG: commonsImage('Gwangjang Market, Seoul 02.jpg'),
  SEOUL_FOREST: commonsImage('SeoulForest.jpg'),
  IKSEONDONG: commonsImage('Ikseon-dong 익선동 October 1 2020 6.jpg'),
  GYEONGUI_FOREST: commonsImage('Gyeonguiseon Forest Trail Park and Ttaeng-ttaeng Street in Seoul (near Hongdae, 1).jpg'),
  DEOKSUGUNG_ROAD: commonsImage('Road of Deoksugung.jpg'),
  SARYEONI: commonsImage('사려니숲길 외부 모습.jpg'),
  CHEONJIYEON: commonsImage('Cheonjiyeon Waterfall (14523691134).jpg'),
  OSULLOC: commonsImage('Osulloc Tea Museum & Fields, Jeju.jpg')
};

const DESTINATION_NAME_IMAGES = {
  경복궁: DESTINATION_IMAGES['SEOUL-001'],
  북촌한옥마을: DESTINATION_IMAGES['SEOUL-002'],
  '성수 카페거리': DESTINATION_IMAGES['SEOUL-003'],
  망원시장: DESTINATION_IMAGES['SEOUL-004'],
  여의도한강공원: DESTINATION_IMAGES['SEOUL-005'],
  여의도: DESTINATION_IMAGES['SEOUL-005'],
  남산서울타워: DESTINATION_IMAGES['SEOUL-006'],
  동대문디자인플라자: DESTINATION_IMAGES['SEOUL-007'],
  청계천: DESTINATION_IMAGES['SEOUL-008'],
  불국사: DESTINATION_IMAGES['GYEONGJU-001'],
  동궁과월지: DESTINATION_IMAGES['GYEONGJU-002'],
  첨성대: DESTINATION_IMAGES['GYEONGJU-003'],
  황리단길: DESTINATION_IMAGES['GYEONGJU-004'],
  보문호수: DESTINATION_IMAGES['GYEONGJU-005'],
  교촌마을: DESTINATION_IMAGES['GYEONGJU-006'],
  월정교: DESTINATION_IMAGES['GYEONGJU-007'],
  대릉원: DESTINATION_IMAGES['GYEONGJU-008'],
  감천문화마을: DESTINATION_IMAGES['BUSAN-001'],
  해운대해수욕장: DESTINATION_IMAGES['BUSAN-002'],
  광안리해변: DESTINATION_IMAGES['BUSAN-003'],
  국제시장: DESTINATION_IMAGES['BUSAN-004'],
  전포카페거리: DESTINATION_IMAGES['BUSAN-005'],
  태종대: DESTINATION_IMAGES['BUSAN-006'],
  자갈치시장: DESTINATION_IMAGES['BUSAN-007'],
  오륙도스카이워크: DESTINATION_IMAGES['BUSAN-008'],
  성산일출봉: DESTINATION_IMAGES['JEJU-001'],
  우도: DESTINATION_IMAGES['JEJU-002'],
  협재해변: DESTINATION_IMAGES['JEJU-003'],
  동문시장: DESTINATION_IMAGES['JEJU-004'],
  애월카페거리: DESTINATION_IMAGES['JEJU-005'],
  절물자연휴양림: DESTINATION_IMAGES['JEJU-006'],
  한라산성판악: DESTINATION_IMAGES['JEJU-007'],
  카멜리아힐: DESTINATION_IMAGES['JEJU-008'],
  석굴암: DESTINATION_IMAGES.SEOKGURAM,
  국립경주박물관: DESTINATION_IMAGES.GYEONGJU_MUSEUM,
  경주월드: DESTINATION_IMAGES.GYEONGJU_WORLD,
  양동마을: DESTINATION_IMAGES.YANGDONG,
  흰여울문화마을: DESTINATION_IMAGES.HUINNYEOUL,
  동백섬: DESTINATION_IMAGES.DONGBAEKSEOM,
  다대포해수욕장: DESTINATION_IMAGES.DADAEPO,
  송정해변: DESTINATION_IMAGES.SONGJEONG,
  창덕궁: DESTINATION_IMAGES.CHANGDEOKGUNG,
  광장시장: DESTINATION_IMAGES.GWANGJANG,
  서울숲: DESTINATION_IMAGES.SEOUL_FOREST,
  익선동한옥거리: DESTINATION_IMAGES.IKSEONDONG,
  연남동경의선숲길: DESTINATION_IMAGES.GYEONGUI_FOREST,
  덕수궁돌담길: DESTINATION_IMAGES.DEOKSUGUNG_ROAD,
  사려니숲길: DESTINATION_IMAGES.SARYEONI,
  천지연폭포: DESTINATION_IMAGES.CHEONJIYEON,
  오설록티뮤지엄: DESTINATION_IMAGES.OSULLOC
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

const QUICK_PURPOSES = ['당일치기 코스', '가족 여행', '로컬 맛집', '사진 명소', '역사 투어', '차량 동선'];

const SERVICE_CATEGORIES = [
  {
    title: '여행 코스 설계',
    detail: '일정과 취향에 맞춘 하루 동선',
    query: '코스',
    icon: 'route'
  },
  {
    title: '숨은 명소',
    detail: '유명지와 근처 보석 같은 장소',
    query: '숨은 명소',
    icon: 'guide'
  },
  {
    title: '맛집·카페 투어',
    detail: '대기와 이동을 줄이는 방문 순서',
    query: '맛집',
    icon: 'food'
  },
  {
    title: '가족 나들이',
    detail: '아이 동반에 맞춘 휴식 많은 코스',
    query: '가족',
    icon: 'family'
  },
  {
    title: '사진 명소',
    detail: '시간대별 빛과 배경이 좋은 장소',
    query: '사진',
    icon: 'camera'
  },
  {
    title: '교통·동선',
    detail: '대중교통, 도보, 차량 이동 최적화',
    query: '교통',
    icon: 'map'
  }
];

const REQUEST_STEPS = [
  {
    title: '취향 입력',
    description: '지역, 날짜, 인원, 원하는 여행 스타일을 간단히 고릅니다.'
  },
  {
    title: 'AI 코스 확인',
    description: 'AI Trip이 관광지 후보와 하루 동선을 큰 시간 블록으로 정리합니다.'
  },
  {
    title: '내 일정 저장',
    description: '마음에 드는 추천 일정을 저장하고 다시 확인합니다.'
  }
];

const REGION_LINKS = ['서울', '부산', '제주', '경주', '강릉', '전주', '여수', '속초', '인천', '대구', '광주', '대전'];

const USER_ROLES = [
  {
    title: '취향 추천',
    label: '추천탐색',
    description: '지역과 관심사를 고르면 잘 맞는 관광지를 먼저 보여줍니다.',
    to: '/destinations'
  },
  {
    title: 'AI 일정',
    label: '일정생성',
    description: '선택한 관광지를 바탕으로 무리 없는 여행 코스를 만듭니다.',
    to: '/planner'
  },
  {
    title: '운영자',
    label: '운영관리',
    description: '데이터 동기화와 운영 화면으로 서비스 상태를 점검합니다.',
    to: '/partners'
  }
];

const PARTNER_TASKS = [
  { title: '사진 품질 점검', detail: '대표 이미지 없는 장소 2곳 확인', tone: 'warning' },
  { title: '예약 문의 응답', detail: '오늘 도착한 문의 4건', tone: 'primary' },
  { title: '추천 태그 정리', detail: '계절 테마에 맞는 태그 업데이트', tone: 'neutral' }
];

function OptionGroup({ label, value, options, onChange }) {
  return (
    <div className="ltOptionGroup">
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? 'active' : ''}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

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
    if (response.status === 401) {
      localStorage.removeItem(AUTH_KEY);
      throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.');
    }
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
  const sourceRef = pickString(row.sourceRef, row.source_ref, row.code);
  if (sourceRef && DESTINATION_IMAGES[sourceRef]) return DESTINATION_IMAGES[sourceRef];
  const name = pickString(row.name, row.title, row.destinationName, row.destination_name, row.placeName, row.place_name).replace(/\s/g, '');
  if (name && DESTINATION_NAME_IMAGES[name]) return DESTINATION_NAME_IMAGES[name];
  return pickString(row.imageUrl, row.image_url, row.photoUrl, row.thumbnailUrl);
}

function exactDestinationImage(row) {
  const explicit = pickString(row.imageUrl, row.image_url, row.photoUrl, row.thumbnailUrl);
  if (explicit) return explicit;
  const sourceRef = pickString(row.sourceRef, row.source_ref, row.code);
  if (sourceRef && DESTINATION_IMAGES[sourceRef]) return DESTINATION_IMAGES[sourceRef];
  const name = pickString(row.name, row.title, row.destinationName, row.destination_name, row.placeName, row.place_name).replace(/\s/g, '');
  return name ? DESTINATION_NAME_IMAGES[name] || '' : '';
}

function imageFallback(event, region, index = 0) {
  event.currentTarget.closest('.ltDestinationPhoto, .ltHeroImage, .ltMiniDestCard')?.classList.add('noPhoto');
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
    return { time: '', title: raw, place: '', note: '', tags: [], imageUrl: regionImage('', index) };
  }
  const item = raw || {};
  const title = pickString(item.title, item.name, item.destinationName, item.destination_name, item.activity) || `Stop ${index + 1}`;
  const place = pickString(item.place, item.location, item.region, item.address);
  return {
    time: pickString(item.time, item.timeSlot, item.time_slot, item.startTime, item.hour),
    title,
    place,
    note: pickString(item.note, item.notes, item.description, item.reason),
    tags: normalizeTags(item.tags, item.keywords, item.primaryStyle, item.primary_style),
    durationMinutes: pickNumber(item.durationMinutes, item.duration_minutes),
    sequenceNumber: pickNumber(item.sequenceNumber, item.sequence_number),
    imageUrl: exactDestinationImage({ ...item, name: title, region: place })
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
      title: pickString(day.title) || `${index + 1}일차`,
      summary: pickString(day.summary),
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
      title: `${day}일차`,
      summary: items.map((item) => item.title).slice(0, 3).join(' · '),
      items
    }));
}

function normalizePlan(raw, index = 0) {
  const plan = raw?.plan || raw?.travelPlan || raw || {};
  const itinerary = normalizeItinerary(plan.dayCards || plan.days || plan.dailyPlans || plan.daily_itinerary || plan.itinerary || plan.schedule || plan.items);
  const id = pickString(plan.id, plan.planId, plan.plan_id);
  const destinationValue = typeof plan.destination === 'string' ? plan.destination : '';
  const destinationName = pickString(plan.destinationName, plan.destination_name, plan.destination?.name, destinationValue);
  const title = pickString(plan.title, plan.name) || (destinationName ? `${destinationName} trip` : `Travel plan ${index + 1}`);
  const explicitDays = pickNumber(plan.daysCount, plan.durationDays, plan.duration_days, plan.days);
  const titleDays = extractDayCount(title, plan.summary, plan.description, plan.overview, plan.markdown, plan.markdownContent, plan.content);
  return {
    id,
    key: id || `plan-${index}`,
    title,
    destinationName: destinationName || 'Selected destination',
    destinationRegion: pickString(plan.destinationRegion, plan.region, plan.destination?.region),
    summary: pickString(plan.summary, plan.description, plan.overview) || 'Day-by-day local route generated for the selected travel style.',
    markdown: pickString(plan.markdown, plan.markdownContent, plan.content),
    startDate: pickString(plan.startDate, plan.start_date),
    days: explicitDays || titleDays || Math.max(itinerary.length, 1),
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
  if (!value) return '날짜 미정';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatDaysLabel(value) {
  const days = Number(value);
  return Number.isFinite(days) && days > 0 ? `${days}일` : '일정 미정';
}

function formatPlanStatus(status) {
  const value = pickString(status);
  if (!value) return '준비 완료';
  const normalized = value.toLowerCase();
  if (normalized === 'ready') return '준비 완료';
  if (normalized === 'draft') return '작성 중';
  if (normalized === 'saved') return '저장됨';
  return value;
}

function extractDayCount(...values) {
  for (const value of values) {
    const text = pickString(value);
    if (!text) continue;
    const koreanMatch = text.match(/(\d{1,2})\s*일/);
    if (koreanMatch) return Number(koreanMatch[1]);
    const englishMatch = text.match(/(\d{1,2})\s*days?/i);
    if (englishMatch) return Number(englishMatch[1]);
  }
  return 0;
}

function scheduleBlockLabel(time, index = 0) {
  const label = pickString(time);
  if (!label) return `코스 ${index + 1}`;
  if (label.length <= 12) return label;
  return `${label.slice(0, 12)}...`;
}

function cleanScheduleTitle(title) {
  return `${title || ''}`.replace(/^\s*\d{1,2}\s*[~:-]\s*\d{1,2}\s*·\s*/, '').trim() || title;
}

function visibleScheduleBullets(bullets) {
  return (bullets || []).filter((bullet) => !/^체류\s*:\s*\d+\s*분/i.test(`${bullet}`.trim()));
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
    )
  };

  return (
    <span className="ltServiceIcon" aria-hidden="true">
      <Icon size={22}>{paths[type] || paths.route}</Icon>
    </span>
  );
}

function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <section className="ltPageTitle">
      <div>
        <span className="ltEyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ltPageActions">{actions}</div> : null}
    </section>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <section className="ltEmptyState">
      <span className="ltEmptyIcon" aria-hidden="true">
        <Icon size={24}>
          <path d="M12 3v18"></path>
          <path d="M5 8h14"></path>
          <path d="M5 16h14"></path>
        </Icon>
      </span>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action || null}
    </section>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="ltFactItem">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function useDestinations() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);

  const load = async () => {
    if (!readStoredAuth()?.token) {
      setDestinations(FALLBACK_DESTINATIONS);
      setUsingFallback(true);
      setLoading(false);
      setError('');
      return;
    }
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
  const travelItems = [
    {
      label: '홈',
      to: '/',
      icon: (
        <>
          <path d="M3 11.5 12 4l9 7.5"></path>
          <path d="M5 10.5V20h14v-9.5"></path>
          <path d="M9 20v-6h6v6"></path>
        </>
      )
    },
    {
      label: '추천장소',
      to: '/destinations',
      icon: (
        <>
          <path d="M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </>
      )
    },
    {
      label: '일정만들기',
      to: '/planner',
      icon: (
        <>
          <path d="M8 2v4"></path>
          <path d="M16 2v4"></path>
          <rect x="3" y="4" width="18" height="18" rx="3"></rect>
          <path d="M3 10h18"></path>
          <path d="m9 16 2 2 4-5"></path>
        </>
      )
    },
    {
      label: '내 일정',
      to: '/plans',
      icon: (
        <>
          <path d="M4 4h16v16H4z"></path>
          <path d="M8 8h8"></path>
          <path d="M8 12h8"></path>
          <path d="M8 16h5"></path>
        </>
      )
    }
  ];
  const accountItems = [
    {
      label: '마이페이지',
      to: '/mypage',
      icon: (
        <>
          <path d="M20 21a8 8 0 0 0-16 0"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </>
      )
    },
    {
      label: '운영',
      to: '/partners',
      icon: (
        <>
          <path d="M3 21h18"></path>
          <path d="M5 21V7l7-4 7 4v14"></path>
          <path d="M9 21v-8h6v8"></path>
          <path d="M9 9h.01"></path>
          <path d="M15 9h.01"></path>
        </>
      )
    }
  ];
  const session = readStoredAuth();

  return (
    <aside className="ltNav">
      <div className="ltNavInner">
        <a className="ltBrand" href="/" onClick={(event) => routeClick(event, '/', navigate)}>
          <strong aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="7" width="16" height="10" rx="3"></rect>
              <path d="M9 17v2"></path>
              <path d="M15 17v2"></path>
              <path d="M9 10h.01"></path>
              <path d="M15 10h.01"></path>
              <path d="M8 7V5"></path>
              <path d="M16 7V5"></path>
              <path d="M12 5v2"></path>
            </svg>
          </strong>
          <span>
            AI Trip
            <small>개인 맞춤 관광지 추천</small>
          </span>
        </a>
        <nav className="ltNavLinks" aria-label="AI Trip 메뉴">
          <div className="ltNavGroup">
            <span className="ltNavGroupTitle">여행</span>
            {travelItems.map((item) => (
              <a
                key={item.to}
                href={item.to}
                className={path === item.to || (item.to !== '/' && path.startsWith(`${item.to}/`)) ? 'active' : ''}
                onClick={(event) => routeClick(event, item.to, navigate)}
              >
                <span className="ltTabIcon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    {item.icon}
                  </svg>
                </span>
                <span className="ltTabLabel">{item.label}</span>
              </a>
            ))}
          </div>
          <div className="ltNavGroup">
            <span className="ltNavGroupTitle">계정/운영</span>
            {accountItems.map((item) => (
              <a
                key={item.to}
                href={item.to}
                className={path === item.to || (item.to !== '/' && path.startsWith(`${item.to}/`)) ? 'active' : ''}
                onClick={(event) => routeClick(event, item.to, navigate)}
              >
                <span className="ltTabIcon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    {item.icon}
                  </svg>
                </span>
                <span className="ltTabLabel">{item.label}</span>
              </a>
            ))}
          </div>
        </nav>
        <a className="ltNavUserCard" href="/mypage" onClick={(event) => routeClick(event, '/mypage', navigate)}>
          <span>{(session?.username || 'G').slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{session?.username || '게스트'}</strong>
            <small>{session?.token ? `${session?.role || 'USER'} 계정 · 내 일정 관리` : '로그인 후 일정 저장'}</small>
          </div>
        </a>
      </div>
    </aside>
  );
}

function DestinationCard({ destination, compact = false, navigate }) {
  return (
    <article className={`ltDestinationCard ${compact ? 'compact' : ''}`}>
      <div className="ltDestinationPhoto">
        {destination.imageUrl ? (
          <img
            src={destination.imageUrl}
            alt={destination.name}
            loading="lazy"
            decoding="async"
            onError={(event) => imageFallback(event, destination.region)}
          />
        ) : (
          <div className="ltPhotoPlaceholder" aria-hidden="true">{destination.region}</div>
        )}
        <span>{destination.category}</span>
      </div>
      <div className="ltDestinationBody">
        <div className="ltCardTopline">
          <span>{destination.region}</span>
          {destination.rating ? (
            <strong className="ltRatingBadge">
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
          <button type="button" className="ltTextButton ltCardLink" onClick={() => navigate(`/planner?destination=${encodeURIComponent(destination.id)}`)}>
            일정에 담기
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
      <div className="ltPlanBadges">
        <span>{plan.destinationRegion || plan.destinationName || '지역 미정'}</span>
        <strong>{formatPlanStatus(plan.status)}</strong>
      </div>
      <h3>{plan.title}</h3>
      <p>{plan.summary}</p>
      <div className="ltPlanMeta">
        <span>{formatDaysLabel(plan.days)}</span>
        <span>{formatDate(plan.startDate)}</span>
        <span>{plan.pace}</span>
        {stats?.rating ? <span>★ {stats.rating.toFixed(1)}</span> : null}
        {stats?.reviewCount ? <span>후기 {formatNumber(stats.reviewCount)}</span> : null}
      </div>
      {plan.id ? (
        <span className="ltPlanOpenHint" aria-hidden="true">
          자세히 보기
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"></path>
            <path d="m12 5 7 7-7 7"></path>
          </svg>
        </span>
      ) : null}
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
      <strong>{fallback ? '샘플 데이터' : '요청 실패'}</strong>
      <span>{error || 'AI Trip API 데이터가 비어 있어 기본 추천 장소를 보여주고 있습니다.'}</span>
    </div>
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
        <span>어디로 떠나고 싶으세요?</span>
        <div className="ltHeroSearchInput">
          <Icon>
            <circle cx="11" cy="11" r="7"></circle>
            <path d="m20 20-3.5-3.5"></path>
          </Icon>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="예: 제주 가족 여행, 부산 맛집, 경주 역사 코스"
          />
          <button type="submit">찾기</button>
        </div>
      </label>
      <div className="ltHeroFilters" aria-label="빠른 필터">
        <button type="button" onClick={() => navigate('/destinations?query=서울')}>서울</button>
        <button type="button" onClick={() => navigate('/destinations?query=제주')}>제주</button>
        <button type="button" onClick={() => navigate('/destinations?query=가족')}>가족 여행</button>
        <button type="button" onClick={() => navigate('/planner')}>AI 일정 만들기</button>
      </div>
    </form>
  );
}

function RoleBand({ navigate }) {
  return (
    <section className="ltRoleBand" aria-label="사용자 역할">
      {USER_ROLES.map((role) => (
        <button key={role.title} type="button" onClick={() => navigate(role.to)}>
          <span>{role.label}</span>
          <strong>{role.title}</strong>
          <p>{role.description}</p>
        </button>
      ))}
    </section>
  );
}

function PurposeRail({ navigate }) {
  return (
    <section className="ltPurposeRail" aria-label="추천 목적">
      <div>
        <span>빠른 추천</span>
        <strong>자주 찾는 여행 테마</strong>
      </div>
      <div className="ltPurposeChips">
        {QUICK_PURPOSES.map((purpose) => (
          <button
            key={purpose}
            type="button"
            onClick={() => navigate(`/destinations?query=${encodeURIComponent(purpose)}`)}
          >
            {purpose}
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
          <h2>여행 취향에 맞는 관광지를 바로 찾으세요</h2>
          <p>테마를 선택하면 관련 장소와 일정 만들기로 이어집니다.</p>
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

function RequestFlowSection({ navigate }) {
  return (
      <section className="ltRequestFlow" aria-label="추천 진행 방식">
      <div className="ltRequestFlowCopy">
        <span className="ltSectionEyebrow">이용 흐름</span>
        <h2>관광지를 고르고, AI가 하루 동선으로 묶습니다</h2>
        <p>AI Trip은 지역, 취향, 이동수단, 여행 속도를 함께 보고 실제로 움직이기 쉬운 코스를 만듭니다.</p>
        <button type="button" className="ltPrimaryButton" onClick={() => navigate('/planner')}>
          AI 일정 만들기
        </button>
      </div>
      <div className="ltRequestSteps">
        {REQUEST_STEPS.map((step, index) => (
          <article key={step.title} className="ltRequestStep">
            <span>{index + 1}</span>
            <strong>{step.title}</strong>
            <p>{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RegionLinks({ navigate }) {
  return (
    <section className="ltRegionLinks" aria-label="지역별 관광지 추천">
      <div>
        <span className="ltSectionEyebrow">전국 관광지</span>
        <h2>지역별 추천을 한 번에</h2>
      </div>
      <div className="ltRegionGrid">
        {REGION_LINKS.map((region) => (
          <button key={region} type="button" onClick={() => navigate(`/destinations?query=${encodeURIComponent(region)}`)}>
            {region}
          </button>
        ))}
      </div>
    </section>
  );
}

function PartnerCta({ navigate }) {
  return (
    <section className="ltPartnerCta" aria-label="운영 데이터 안내">
      <div>
        <span className="ltSectionEyebrow">운영자 도구</span>
        <h2>추천 장소와 생성 일정을 운영 화면에서 점검하세요</h2>
        <p>장소 데이터, 태그 품질, 추천 일정 테스트를 한 화면에서 확인할 수 있습니다.</p>
      </div>
      <button type="button" className="ltSecondaryButton" onClick={() => navigate('/partners')}>
        운영 화면 보기
      </button>
    </section>
  );
}

function HomePage({ navigate }) {
  const { destinations, loading, error, usingFallback } = useDestinations();
  const { plans, loading: plansLoading } = usePlans(3);
  const [heroQuery, setHeroQuery] = useState('');
  const topDestinations = destinations.slice(0, 3);
  const heroImages = topDestinations.length ? topDestinations : FALLBACK_DESTINATIONS;

  return (
    <main className="ltPage">
      <section className="ltHero">
        <div className="ltHeroCopy">
          <span className="ltEyebrow">AI Trip</span>
          <h1>나에게 맞는 관광지를 추천받으세요</h1>
          <p>지역, 날짜, 인원, 취향을 입력하면 방문하기 좋은 장소와 무리 없는 여행 동선을 한 번에 정리합니다.</p>
          <HeroSearch query={heroQuery} setQuery={setHeroQuery} navigate={navigate} />
          <div className="ltHeroActions">
            <a href="/planner" onClick={(event) => routeClick(event, '/planner', navigate)}>
              AI 일정 만들기
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </a>
            <a href="/destinations" onClick={(event) => routeClick(event, '/destinations', navigate)}>추천장소 보기</a>
          </div>
        </div>
        <div className="ltHeroVisual">
          <div className="ltHeroImage main" style={{ backgroundImage: heroImages[0]?.imageUrl ? `url("${heroImages[0].imageUrl}")` : 'none' }}>
            <span>{heroImages[0]?.region || 'Local'}</span>
          </div>
          <div className="ltHeroImage" style={{ backgroundImage: heroImages[1]?.imageUrl ? `url("${heroImages[1].imageUrl}")` : 'none' }}>
            <span>{heroImages[1]?.region || 'Local'}</span>
          </div>
          <div className="ltHeroImage" style={{ backgroundImage: heroImages[2]?.imageUrl ? `url("${heroImages[2].imageUrl}")` : 'none' }}>
            <span>{heroImages[2]?.region || 'Local'}</span>
          </div>
          <div className="ltHeroPanel">
            <div>
              <span>추천 장소</span>
              <strong>{loading ? '-' : formatNumber(destinations.length)}</strong>
            </div>
            <div>
              <span>저장 일정</span>
              <strong>{plansLoading ? '-' : formatNumber(plans.length)}</strong>
            </div>
            <div>
              <span>추천 지역</span>
              <strong>{heroImages[0]?.region || '-'}</strong>
            </div>
          </div>
        </div>
      </section>

      <InlineNotice error={error} fallback={usingFallback} />

      <PurposeRail navigate={navigate} />
      <ServiceCategoryGrid navigate={navigate} />
      <RoleBand navigate={navigate} />

      <section className="ltSectionHeader">
        <div>
          <span className="ltSectionEyebrow">맞춤 추천</span>
          <h2>지금 둘러보기 좋은 관광지</h2>
          <p style={{ color: '#64748b', marginTop: '4px' }}>사진, 후기 흐름, 지역별 관심도를 기준으로 고른 추천 장소</p>
        </div>
        <a href="/destinations" onClick={(event) => routeClick(event, '/destinations', navigate)} className="ltTextButton" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          전체 보기
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

      <RequestFlowSection navigate={navigate} />

      <section className="ltSplitSection" style={{ marginTop: '80px', gap: '32px' }}>
        <div className="ltPlannerTeaser">
          <h2>선택한 관광지를 읽기 쉬운 일정으로 묶어보세요</h2>
          <p>오전, 점심·휴식, 오후, 저녁처럼 큰 시간 블록으로 실제 여행 동선을 구성합니다.</p>
          <button type="button" onClick={() => navigate('/planner')}>
            AI 일정 만들기
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
              <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline>
            </svg>
          </button>
        </div>
        <div className="ltRecentPlans">
          <div className="ltSectionHeader compact">
            <div>
              <h2>최근 만든 일정</h2>
            </div>
          </div>
          {plans.length ? plans.map((plan) => <PlanCard key={plan.key} plan={plan} navigate={navigate} />) : (
            <div className="ltEmptyState">아직 만든 일정이 없습니다.</div>
          )}
        </div>
      </section>

      <RegionLinks navigate={navigate} />
      <PartnerCta navigate={navigate} />
    </main>
  );
}

function DestinationsPage({ path, navigate }) {
  const { destinations, loading, error, usingFallback, reload } = useDestinations();
  const params = new URLSearchParams(path.split('?')[1] || '');
  const initialQuery = params.get('query') || '';
  const [query, setQuery] = useState(initialQuery);
  const [region, setRegion] = useState('all');
  const [tag, setTag] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);
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
      <PageHeader
        eyebrow="추천장소"
        title="내 여행에 맞는 관광지"
        description="지역과 여행 스타일을 고르면 지금 방문하기 좋은 국내 관광지를 모아 보여드립니다."
        actions={(
          <button type="button" className="ltGhostButton ltAdminButton" onClick={syncMock} disabled={syncing}>
            {syncing ? '동기화 중' : '관리자 데이터 동기화'}
          </button>
        )}
      />

      <InlineNotice error={error} fallback={usingFallback} />
      {syncError ? <div className="ltInlineNotice error"><strong>동기화 실패</strong><span>{syncError}</span></div> : null}

      <details className="ltFold ltFilterFold">
        <summary>
          <span>검색과 필터</span>
          <strong>{filtered.length}곳</strong>
        </summary>
        <section className="ltFilterBar">
          <label>
            <span>검색</span>
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
      </details>

      {loading ? <EmptyState title="장소를 불러오는 중입니다" description="추천 장소와 이미지를 정리하고 있어요." /> : null}
      {!loading && !filtered.length ? <EmptyState title="조건에 맞는 장소가 없습니다" description="검색어를 줄이거나 다른 지역, 스타일을 선택해보세요." /> : null}
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
    const destinationIds = selectedDestObjects
      .map((destination) => Number(destination.id))
      .filter((id) => Number.isFinite(id));

    const payload = {
      regions,
      destinationIds,
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
      <PageHeader
        eyebrow="일정만들기"
        title="AI 여행 일정을 만들어보세요"
        description="방문할 관광지, 여행 일수, 동행 스타일을 고르면 AI가 하루 동선을 깔끔하게 정리합니다."
      />

      <InlineNotice error={error} fallback={usingFallback} />

      <div className="ltStepBar" aria-label="일정 생성 단계">
        <span className={selectedDestinationIds.length ? 'active' : ''}>1 장소</span>
        <span className={startDate || days ? 'active' : ''}>2 일정</span>
        <span className={selectedInterests.length ? 'active' : ''}>3 취향</span>
      </div>

      <section className="ltPlannerLayout">
        <form className="ltPlannerForm" onSubmit={submit}>
          <div className="ltFormSection">
            <div className="ltFormSectionTitle">
              <span>Step 1</span>
              <strong>방문할 장소</strong>
            </div>
            <div className="ltAutocompleteGroup">
            <label>
              <span>장소 검색</span>
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
                  <button type="button" onClick={() => toggleDestination(d.id)} aria-label="삭제">×</button>
                </span>
              ))}
            </div>
            </div>
          </div>

          <div className="ltFormSection">
            <div className="ltFormSectionTitle">
              <span>Step 2</span>
              <strong>여행 기본 정보</strong>
            </div>
            <div className="ltFormGrid">
              <label>
                <span>출발일</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label>
                <span>여행 일수</span>
                <input type="number" min="1" max="7" value={days} onChange={(event) => setDays(event.target.value)} />
              </label>
            </div>
            <div className="ltFormGrid">
              <OptionGroup label="동행" value={travelers} options={['혼자', '커플', '친구', '가족']} onChange={setTravelers} />
              <OptionGroup label="여행 속도" value={pace} options={['여유', '보통', '촘촘']} onChange={setPace} />
            </div>
            <div className="ltFormGrid">
              <OptionGroup label="이동수단" value={transportType} options={['대중교통', '자동차', '도보']} onChange={setTransportType} />
              <OptionGroup label="내보내기" value={exportFormat} options={['텍스트', '엑셀', 'PDF']} onChange={setExportFormat} />
            </div>
            <OptionGroup label="예산" value={budget} options={['절약', '보통', '프리미엄']} onChange={setBudget} />
          </div>

          <div className="ltFormSection">
            <div className="ltFormSectionTitle">
              <span>Step 3</span>
              <strong>취향과 요청사항</strong>
            </div>
            <div className="ltInterestGroup">
              <span>관심사</span>
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
              <span>요청사항</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="도착 시간, 꼭 가고 싶은 곳, 아이 동반 여부 등을 적어주세요" />
            </label>
          </div>
          {generateError ? <div className="ltInlineNotice error"><strong>생성 실패</strong><span>{generateError}</span></div> : null}
          <button type="submit" className="ltPrimaryButton ltStickyCta" disabled={generating || selectedDestinationIds.length === 0}>
            {generating ? '일정 생성 중' : 'AI 일정 만들기'}
          </button>
        </form>

        <aside className="ltPlannerPreview">
          <div className="ltSelectedSummary">
            <h3>선택한 장소 ({selectedDestinationIds.length})</h3>
            <div className="ltMiniDestList">
              {destinations.filter(d => selectedDestinationIds.includes(d.id)).map(d => (
                <div key={d.id} className="ltMiniDestCard">
                  {d.imageUrl ? (
                    <img
                      className="ltMiniDestPhoto"
                      src={d.imageUrl}
                      alt={d.name}
                      loading="lazy"
                      decoding="async"
                      onError={(event) => imageFallback(event, d.region)}
                    />
                  ) : (
                    <div className="ltMiniDestPhoto placeholder" aria-hidden="true">{d.region}</div>
                  )}
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
              <PlanDayCards plan={generatedPlan} />
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
      <PageHeader
        eyebrow="내 일정"
        title="저장된 추천 일정"
        description="생성한 코스를 다시 열어보고 여행 스타일에 맞게 정렬할 수 있어요."
        actions={(
          <>
          <div className="ltSegmented compact" aria-label="일정 정렬">
            <button type="button" className={sortMode === 'recommended' ? 'active' : ''} onClick={() => setSortMode('recommended')}>추천순</button>
            <button type="button" className={sortMode === 'rating' ? 'active' : ''} onClick={() => setSortMode('rating')}>평점순</button>
            <button type="button" className={sortMode === 'reviews' ? 'active' : ''} onClick={() => setSortMode('reviews')}>후기순</button>
            <button type="button" className={sortMode === 'latest' ? 'active' : ''} onClick={() => setSortMode('latest')}>최신순</button>
          </div>
          <button type="button" className="ltIconButton" onClick={reload} aria-label="일정 새로고침">
            <Icon size={18}>
              <path d="M21 12a9 9 0 0 1-15.3 6.4"></path>
              <path d="M3 12A9 9 0 0 1 18.3 5.6"></path>
              <path d="M3 18v-5h5"></path>
              <path d="M21 6v5h-5"></path>
            </Icon>
          </button>
          </>
        )}
      />

      {error ? <div className="ltInlineNotice error"><strong>요청 실패</strong><span>{error}</span></div> : null}
      {loading ? <EmptyState title="일정을 불러오는 중입니다" description="저장된 코스를 정리하고 있어요." /> : null}
      {!loading && !plans.length ? (
        <EmptyState
          title="아직 저장된 일정이 없습니다"
          description="관심 장소를 고르고 AI 일정 만들기로 첫 코스를 저장해보세요."
          action={<button type="button" className="ltPrimaryButton" onClick={() => navigate('/planner')}>새 일정 만들기</button>}
        />
      ) : null}
      <div className="ltPlansGrid">
        {sortedPlans.map(({ plan, stats }) => <PlanCard key={plan.key} plan={plan} stats={stats} navigate={navigate} />)}
      </div>
    </main>
  );
}

function PartnerPage({ navigate }) {
  const { destinations, loading } = useDestinations();
  const { plans } = usePlans();
  const promotedDestinations = destinations.slice(0, 4);
  const totalReviews = destinations.reduce((sum, destination) => sum + Number(destination.reviewCount || 0), 0);
  const averageRating = destinations.length
    ? destinations.reduce((sum, destination) => sum + Number(destination.rating || 0), 0) / destinations.length
    : 0;

  return (
    <main className="ltPage">
      <section className="ltPartnerHero">
        <div>
          <span className="ltEyebrow">Partner Center</span>
          <h1>추천 데이터 운영 화면</h1>
          <p>관광지 노출, 사진·태그 품질, 생성 일정 데이터를 관리하는 운영자용 대시보드입니다.</p>
        </div>
        <div className="ltPartnerHeroActions">
          <button type="button" className="ltPrimaryButton" onClick={() => navigate('/destinations')}>
            노출 현황 보기
          </button>
          <button type="button" className="ltSecondaryButton" onClick={() => navigate('/planner')}>
            추천 일정 테스트
          </button>
        </div>
      </section>

      <section className="ltPartnerStats" aria-label="추천 운영 지표">
        <div className="ltFactItem">
          <span>등록 장소</span>
          <strong>{loading ? '-' : `${destinations.length}곳`}</strong>
        </div>
        <div className="ltFactItem">
          <span>평균 평점</span>
          <strong>{averageRating ? averageRating.toFixed(1) : '-'}</strong>
        </div>
        <div className="ltFactItem">
          <span>누적 반응</span>
          <strong>{formatNumber(totalReviews)}</strong>
        </div>
        <div className="ltFactItem">
          <span>생성 일정</span>
          <strong>{plans.length}개</strong>
        </div>
      </section>

      <section className="ltPartnerGrid">
        <div className="ltPartnerPanel">
          <div className="ltSectionHeader compact">
            <div>
              <h2>운영 할 일</h2>
              <p>예약 전환에 영향이 큰 항목부터 정리했습니다.</p>
            </div>
          </div>
          <div className="ltTaskList">
            {PARTNER_TASKS.map((task) => (
              <article key={task.title} className={`ltTaskCard ${task.tone}`}>
                <span aria-hidden="true">
                  <Icon size={20}>
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </Icon>
                </span>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="ltPartnerPanel">
          <div className="ltSectionHeader compact">
            <div>
              <h2>대표 노출 장소</h2>
              <p>여행자 홈과 검색 결과에 먼저 보여줄 후보입니다.</p>
            </div>
          </div>
          <div className="ltPartnerDestList">
            {promotedDestinations.map((destination) => (
              <DestinationCard key={destination.id} destination={destination} compact navigate={navigate} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function parseMarkdownPlan(markdown) {
  const lines = `${markdown || ''}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const days = [];
  let currentDay = null;
  let currentItem = null;

  for (const line of lines) {
    if (line.startsWith('# ') || line.startsWith('>')) {
      continue;
    }
    if (line.startsWith('- 지역:') || line.startsWith('- 기간:') || line.startsWith('- 동행:') || line.startsWith('- 속도:') || line.startsWith('- 취향:')) {
      continue;
    }
    if (line.startsWith('## ')) {
      currentDay = { day: line.slice(3).trim(), items: [] };
      days.push(currentDay);
      currentItem = null;
      continue;
    }
    if (line.startsWith('### ')) {
      if (!currentDay) {
        currentDay = { day: 'Day 1', items: [] };
        days.push(currentDay);
      }
      currentItem = { title: line.slice(4).trim(), bullets: [], paragraphs: [] };
      currentDay.items.push(currentItem);
      continue;
    }
    if (line.startsWith('- ')) {
      if (currentItem) {
        currentItem.bullets.push(line.slice(2).trim());
      }
      continue;
    }
    if (currentItem) {
      currentItem.paragraphs.push(line);
    }
  }

  return days;
}

function markdownBlocksFromItinerary(itinerary) {
  return itinerary.map((day) => ({
    day: `Day ${day.day}`,
    items: day.items.map((item) => ({
      title: `${item.time || '유동적'} · ${item.title}`,
      paragraphs: item.note ? [item.note] : [],
      bullets: [
        item.place ? `장소: ${item.place}` : '',
        item.tags && item.tags.length ? `테마: ${item.tags.join(', ')}` : ''
      ].filter(Boolean)
    }))
  }));
}

function MarkdownPlanBlocks({ plan }) {
  const itinerary = plan?.itinerary || [];
  const markdownDays = parseMarkdownPlan(plan?.markdown);
  const dayBlocks = markdownDays.length ? markdownDays : markdownBlocksFromItinerary(itinerary);
  if (!dayBlocks.length) {
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
    <div className="ltMarkdownPlan" aria-label="여행 일정">
      {dayBlocks.map((day) => (
        <section className="ltMarkdownDayBlock" key={day.day}>
          <div className="ltMarkdownDayHeader">
            <span>##</span>
            <h2>{day.day}</h2>
          </div>
          <div className="ltMarkdownItems">
            {day.items.map((item, index) => (
              <article className="ltMarkdownBlock" key={`${day.day}-${item.title}-${index}`}>
                <div className="ltMarkdownHeading">
                  <span>{index + 1}</span>
                  <h3>{cleanScheduleTitle(item.title)}</h3>
                </div>
                {item.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                <ul>
                  {visibleScheduleBullets(item.bullets).map((bullet) => {
                    const [label, ...rest] = bullet.split(':');
                    const value = rest.join(':').trim();
                    return (
                      <li key={bullet}>
                        {value ? <><strong>{label.trim()}</strong> {value}</> : bullet}
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PlanDayCards({ plan }) {
  const itinerary = plan?.itinerary || [];
  if (!itinerary.length) {
    return <MarkdownPlanBlocks plan={plan} />;
  }

  return (
    <div className="ltDayCards" aria-label="일자별 여행 일정">
      {itinerary.map((day) => (
        <section className="ltDayCard" key={day.day}>
          <div className="ltDayCardHeader">
            {day.items.find((item) => item.imageUrl)?.imageUrl ? (
              <img
                className="ltDayCover"
                src={day.items.find((item) => item.imageUrl).imageUrl}
                alt={day.title || `${day.day}일차`}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="ltDayCover placeholder" aria-hidden="true">{day.day}일차</div>
            )}
            <div>
              <span>{day.day}일차</span>
              <h2>{day.title || `${day.day}일차`}</h2>
              {day.summary ? <p>{day.summary}</p> : null}
            </div>
          </div>
          <div className="ltDaySlots">
            {day.items.map((item, index) => (
              <article className="ltDaySlot" key={`${day.day}-${item.time}-${item.title}-${index}`}>
                <time>
                  <span>{scheduleBlockLabel(item.time, index)}</span>
                </time>
                <div className="ltDaySlotBody">
                  <div>
                    <h3>{item.title}</h3>
                    <div className="ltDaySlotMeta">
                      {item.place ? <span>{item.place}</span> : null}
                      {item.durationMinutes ? <span>{item.durationMinutes}분</span> : null}
                    </div>
                  </div>
                  {item.note ? <p>{item.note}</p> : null}
                  <div className="ltTagRow small">
                    {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
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
            <h2>일자별 일정</h2>
          </div>
          <PlanDayCards plan={plan} />
        </div>
      ) : null}
    </main>
  );
}

function NotFoundPage({ navigate }) {
  return (
    <main className="ltPage">
      <section className="ltEmptyState large">
        <h1>페이지를 찾을 수 없습니다</h1>
        <button type="button" className="ltPrimaryButton" onClick={() => navigate('/')}>홈으로 이동</button>
      </section>
    </main>
  );
}

function MyPage({ navigate }) {
  const session = readStoredAuth();
  const { destinations, loading: destinationsLoading } = useDestinations();
  const { plans, loading: plansLoading } = usePlans();
  const recentPlans = plans.slice(0, 3);

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = '/';
  };

  return (
    <main className="ltPage">
      <section className="ltMyHero">
        <div className="ltMyAvatar" aria-hidden="true">
          {(session?.username || 'U').slice(0, 1).toUpperCase()}
        </div>
        <div className="ltMyHeroText">
          <span className="ltEyebrow">My Page</span>
          <h1>{session?.username || '여행자'}님의 여행 공간</h1>
          <p>저장한 일정과 여행 준비 상태를 한 곳에서 확인하고 다음 코스를 바로 이어서 만들 수 있습니다.</p>
          <div className="ltMyHeroMeta">
            <span>{session?.role || 'USER'}</span>
            <span>ID/PW 로그인</span>
          </div>
        </div>
        <div className="ltMyActions">
          <button type="button" className="ltPrimaryButton" onClick={() => navigate('/planner')}>새 일정 만들기</button>
          <button type="button" className="ltGhostButton" onClick={logout}>로그아웃</button>
        </div>
      </section>

      <section className="ltMyStats" aria-label="내 여행 요약">
        <StatCard label="계정 등급" value={session?.role || 'USER'} hint="여행 공간 권한" />
        <StatCard label="저장 일정" value={plansLoading ? '-' : `${plans.length}개`} hint="보관함 기준" />
        <StatCard label="추천 장소" value={destinationsLoading ? '-' : `${destinations.length}곳`} hint="현재 노출 가능" />
        <StatCard label="로그인 방식" value="ID/PW" hint="로컬 계정" />
      </section>

      <section className="ltMyGrid">
        <details className="ltMyPanel ltFold" open>
          <summary>
            <span>최근 일정</span>
            <button type="button" className="ltTextButton" onClick={(event) => {
              event.preventDefault();
              navigate('/plans');
            }}>전체 보기</button>
          </summary>
          <div className="ltMyPlanList">
            {recentPlans.length ? recentPlans.map((plan) => (
              <PlanCard key={plan.key} plan={plan} navigate={navigate} />
            )) : (
              <EmptyState title="최근 일정이 없습니다" description="새 일정 만들기로 첫 여행 코스를 저장해보세요." />
            )}
          </div>
        </details>

        <details className="ltMyPanel ltFold" open>
          <summary>
            <span>계정 정보</span>
          </summary>
          <dl className="ltProfileList">
            <div>
              <dt>아이디</dt>
              <dd>{session?.username || '-'}</dd>
            </div>
            <div>
              <dt>권한</dt>
              <dd>{session?.role || '-'}</dd>
            </div>
            <div>
              <dt>분석 워크스페이스</dt>
              <dd>
                <span>비공개</span>
              </dd>
            </div>
          </dl>
          <div className="ltMyShortcutList">
            <button type="button" onClick={() => navigate('/destinations')}>장소 둘러보기</button>
            <button type="button" onClick={() => navigate('/planner')}>AI 일정 만들기</button>
            <button type="button" onClick={() => navigate('/plans')}>내 일정 보기</button>
          </div>
        </details>
      </section>
    </main>
  );
}

function AppShell({ path, navigate, children }) {
  return (
    <div className="ltShell">
      <LocalTripNav path={path} navigate={navigate} />
      {children}
      <footer className="ltFooter">
        <span>AI Trip</span>
        <span>여행자 · 추천 엔진 · 운영자</span>
      </footer>
    </div>
  );
}

export default function LocalTripApp({ path, navigate }) {
  useEffect(() => {
    document.title = 'AI Trip';
  }, [path]);

  const normalizedPath = path || '/';
  const cleanPath = normalizedPath.split('?')[0];
  let page;
  if (cleanPath === '/') {
    page = <HomePage navigate={navigate} />;
  } else if (cleanPath === '/destinations') {
    page = <DestinationsPage path={normalizedPath} navigate={navigate} />;
  } else if (cleanPath === '/planner') {
    page = <PlannerPage path={normalizedPath} navigate={navigate} />;
  } else if (cleanPath === '/plans') {
    page = <PlansPage navigate={navigate} />;
  } else if (cleanPath === '/partners') {
    page = <PartnerPage navigate={navigate} />;
  } else if (cleanPath === '/mypage') {
    page = <MyPage navigate={navigate} />;
  } else if (cleanPath.startsWith('/plans/')) {
    page = <PlanDetailPage planId={decodeURIComponent(cleanPath.replace('/plans/', ''))} navigate={navigate} />;
  } else {
    page = <NotFoundPage navigate={navigate} />;
  }

  return <AppShell path={cleanPath} navigate={navigate}>{page}</AppShell>;
}
