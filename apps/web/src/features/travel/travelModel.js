export const TRAVEL_INTERESTS = ['맛집', '자연', '역사', '카페', '가족', '사진', '쇼핑'];
export const TRAVEL_PACES = ['여유롭게', '보통', '알차게'];
export const TRAVEL_PORT = 4319;
export const TRAVEL_BODY_LIMIT = 16 * 1024;
export const TRAVEL_RESULT_LIMIT = 128 * 1024;

const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function validTravelDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function travelDateOffset(date, offset) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + offset);
  return next.toISOString().slice(0, 10);
}
export function newTravelDraft(today) {
  return { destination: '', startDate: today, days: 3, people: 2, pace: '보통', interests: [], requests: '' };
}
export function validateTravelInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('여행 정보를 확인해주세요.');
  const destination = text(raw.destination, 100);
  if (!destination || String(raw.destination).length > 100) throw new Error('여행지를 100자 이내로 입력해주세요.');
  if (!validTravelDate(raw.startDate) || raw.startDate < '2000-01-01' || raw.startDate > '2099-12-01') throw new Error('출발 날짜를 확인해주세요.');
  const days = Number(raw.days);
  const people = Number(raw.people);
  if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error('여행 기간은 1~14일로 선택해주세요.');
  if (!Number.isInteger(people) || people < 1 || people > 20) throw new Error('인원은 1~20명으로 입력해주세요.');
  if (!TRAVEL_PACES.includes(raw.pace)) throw new Error('여행 속도를 선택해주세요.');
  if (!Array.isArray(raw.interests) || raw.interests.length > TRAVEL_INTERESTS.length || raw.interests.some(item => !TRAVEL_INTERESTS.includes(item))) throw new Error('여행 취향을 다시 선택해주세요.');
  if (typeof raw.requests !== 'string' || raw.requests.length > 2000) throw new Error('요청사항은 2,000자 이내로 입력해주세요.');
  return { destination, startDate: raw.startDate, days, people, pace: raw.pace, interests: [...new Set(raw.interests)], requests: text(raw.requests, 2000) };
}

export function importLegacyTravelDraft(raw, today) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return {
    ...newTravelDraft(today),
    destination: text(raw.destinationName || raw.destinationRegion, 100),
    startDate: validTravelDate(raw.startDate) ? raw.startDate : today,
    days: Math.min(14, Math.max(1, Math.round(Number(raw.days) || 3))),
    people: raw.travelers === '혼자' ? 1 : 2,
    pace: TRAVEL_PACES.includes(raw.pace) ? raw.pace : '보통',
    interests: (Array.isArray(raw.interests) ? raw.interests : []).filter(item => TRAVEL_INTERESTS.includes(item)),
    requests: text([
      text(raw.notes, 2000),
      raw.travelers ? `동행: ${text(raw.travelers, 50)}` : '',
      ...(Array.isArray(raw.dayRoutes) ? raw.dayRoutes.slice(0, 14).map((route, index) => {
        const start = text(route?.startPlace, 60), end = text(route?.endPlace, 60);
        return start || end ? `${index + 1}일차 출발·도착: ${start || '미정'} → ${end || '미정'}` : '';
      }) : [])
    ].filter(Boolean).join('\n'), 2000)
  };
}

const stringField = (maxLength) => ({ type: 'string', maxLength });
const objectSchema = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const TRAVEL_OUTPUT_SCHEMA = objectSchema({
  title: stringField(120),
  summary: stringField(800),
  days: {
    type: 'array', minItems: 1, maxItems: 14,
    items: objectSchema({
      day: { type: 'integer', minimum: 1, maximum: 14 },
      title: stringField(120),
      items: {
        type: 'array', minItems: 1, maxItems: 10,
        items: objectSchema({ time: stringField(5), title: stringField(120), place: stringField(160), description: stringField(600), transport: stringField(300), estimatedCost: stringField(160) })
      }
    })
  },
  tips: { type: 'array', maxItems: 8, items: stringField(400) },
  sources: { type: 'array', maxItems: 12, items: objectSchema({ title: stringField(160), url: stringField(1000) }) }
});

function requiredText(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('생성된 여행 내용이 올바르지 않아요. 다시 생성해주세요.');
  return value.trim();
}
function optionalText(value, max) {
  if (typeof value !== 'string' || value.length > max) throw new Error('여행 내용의 길이가 올바르지 않아요.');
  return value.trim();
}
export function publicTravelSource(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.')
      || /^(?:\d+\.){3}\d+$/.test(url.hostname) || /(?:^|\.)(localhost|local|internal)$/.test(url.hostname)) return '';
    return url.href;
  } catch { return ''; }
}

// Both the local API and the web client enforce this contract before persistence.
export function validateTravelPlan(raw, input) {
  const request = validateTravelInput(input);
  if (!raw || !Array.isArray(raw.days) || raw.days.length !== request.days) throw new Error('요청한 여행 기간과 생성된 일정이 달라요. 다시 생성해주세요.');
  const days = raw.days.map((day, index) => {
    if (!day || day.day !== index + 1 || !Array.isArray(day.items) || !day.items.length || day.items.length > 10) throw new Error('일차별 일정이 올바르지 않아요.');
    let previousTime = '';
    const seen = new Set();
    const items = day.items.map(item => {
      if (!item || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) || item.time < previousTime) throw new Error('일정의 시간 순서가 올바르지 않아요.');
      previousTime = item.time;
      const title = requiredText(item.title, 120);
      const key = `${item.time}:${title}`;
      if (seen.has(key)) throw new Error('같은 일정이 중복 생성됐어요. 다시 생성해주세요.');
      seen.add(key);
      return { time: item.time, title, place: requiredText(item.place, 160), description: requiredText(item.description, 600), transport: optionalText(item.transport, 300), estimatedCost: optionalText(item.estimatedCost, 160) };
    });
    return { day: index + 1, date: travelDateOffset(request.startDate, index), title: requiredText(day.title, 120), items };
  });
  if (!Array.isArray(raw.tips) || raw.tips.length > 8 || !Array.isArray(raw.sources) || raw.sources.length > 12) throw new Error('여행 참고 정보가 올바르지 않아요.');
  return {
    title: requiredText(raw.title, 120), summary: requiredText(raw.summary, 800), days,
    tips: raw.tips.map(item => requiredText(item, 400)),
    sources: raw.sources.map(item => ({ title: requiredText(item.title, 160), url: publicTravelSource(item.url) })).filter(item => item.url)
  };
}

// Apply the new time window to generated plans only; older saved trips remain readable.
export function validateGeneratedTravelPlan(raw, input) {
  const plan = validateTravelPlan(raw, input);
  if (plan.days.some(day => day.items.some(item => item.time < '10:00' || item.time > '22:00'))) {
    throw new Error('일정은 10:00~22:00 사이여야 해요. 다시 생성해주세요.');
  }
  return plan;
}
