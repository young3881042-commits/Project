const UI_CHANGE_REQUEST = /(?:(?:버튼|화면|기능|컴포넌트|레이아웃|UI|UX|코드|파서|로직|버그).{0,24}(?:고쳐|수정|구현|개발|만들|추가해|바꿔)|(?:고쳐|수정|구현|개발|만들|바꿔).{0,24}(?:버튼|화면|기능|컴포넌트|레이아웃|UI|UX|코드|파서|로직|버그))/i;
const NEGATIVE_RECORD_REQUEST = /(?:^(?:취소|그만|아니(?:야|요)?|됐어)|(?:메모|기록|지출|수입|운동|식단|칼로리|저장|등록|추가).{0,18}(?:하지\s*마|하지\s*말|말아|취소(?:해|할게|해주세요)?|아니(?:야|에요)?|아님)|(?:안|못)\s*(?:했어|했어요|먹었어|먹었어요|썼어|썼어요|받았어|받았어요|운동했어|운동했어요)\s*[.!?]*$)/;
const META_REQUEST = /(?:(?:방법|예시|형식).{0,16}(?:알려|설명)|(?:어떻게|라고\s*(?:말|쓰)|입력하면|기록하면).{0,16}(?:돼|되나요|될까))/;
const SCHEDULE_CREATE_REQUEST = /(?:일정|약속).{0,24}(?:추가|등록|생성|만들|잡아|넣어)/;

const MONEY_TOKEN_SOURCE = '(?:\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s*(?:만원|천원|원)';
const MONEY_TOKEN = new RegExp(`^(${MONEY_TOKEN_SOURCE})$`);
const MONEY_TOKEN_ANYWHERE = new RegExp(MONEY_TOKEN_SOURCE);
const TRAILING_FINANCE = new RegExp(`^(.+?)\\s+(${MONEY_TOKEN_SOURCE})\\s*(지출|수입)(?:\\s*(?:기록|등록|저장)(?:해\\s*줘|해주세요|해줘)?)?\\s*[.!?]?$`);
const PREFIX_FINANCE = new RegExp(`^(지출|수입)\\s*[:：]\\s*(.+?)\\s+(${MONEY_TOKEN_SOURCE})\\s*[.!?]?$`);

const MEAL_TYPES = Object.freeze({
  아침: 'breakfast',
  점심: 'lunch',
  저녁: 'dinner',
  간식: 'snack'
});

const MEAL_LABELS = Object.freeze({
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식'
});

const DIET_LINE = /^(아침|점심|저녁|간식)(?:\s*[:：]\s*|\s+)(.+?)\s+([0-9][0-9,]*)\s*(?:kcal|킬로칼로리|칼로리)\s*[.!?]?$/i;
const WORKOUT_LINE = /^(빠른\s*걷기|팔굽혀펴기|필라테스|스트레칭|일립티컬|줄넘기|인터벌|자전거|조깅|러닝|달리기|걷기|산책|상체|하체|스쿼트|런지|푸시업|근력|헬스|요가)(?:\s*운동)?\s+([0-9]{1,3})\s*분(?:\s*(?:운동|기록))?\s*[.!?]?$/;

const WON_FORMATTER = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validDateKey(value) {
  const match = String(value || '').match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3]);
}

function inputLine(value) {
  const raw = String(value || '').normalize('NFKC').trim();
  if (!raw || /[\r\n]/.test(raw) || raw.length > 500) return '';
  return raw.replace(/[\t ]+/g, ' ');
}

function fingerprintPart(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ko-KR')
    .replace(/\s+/g, ' ');
}

function fingerprintHash(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= code >>> 8;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function recordFingerprint(kind, parts) {
  const semanticValue = JSON.stringify([kind, ...parts.map(fingerprintPart)]);
  return `life-record:v1:${kind}:${fingerprintHash(semanticValue)}`;
}

function result(kind, draft, confirmationText, fingerprintParts) {
  return {
    kind,
    draft,
    confirmationText,
    fingerprint: recordFingerprint(kind, fingerprintParts)
  };
}

function parseMemo(input) {
  const match = input.match(/^메모\s*[:：]\s*(.+)$/);
  if (!match) return null;
  const body = match[1].trim();
  if (!body || body.length > 300) return null;
  const preview = body.length > 80 ? `${body.slice(0, 77)}...` : body;
  return result(
    'memo',
    { title: '', body, tags: [] },
    `메모로 기록할게요.\n\n**${preview}**`,
    [body]
  );
}

function parseMoney(token) {
  const match = String(token || '').trim().match(MONEY_TOKEN);
  if (!match) return null;
  const unitMatch = match[1].match(/(만원|천원|원)$/);
  if (!unitMatch) return null;
  const unit = unitMatch[1];
  const numberText = match[1].slice(0, -unit.length).trim();
  if (numberText.includes(',') && !/^\d{1,3}(?:,\d{3})+$/.test(numberText)) return null;
  if (unit === '원' && numberText.includes('.')) return null;
  const number = Number(numberText.replaceAll(',', ''));
  const multiplier = unit === '만원' ? 10000 : unit === '천원' ? 1000 : 1;
  const amount = number * multiplier;
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 1 || amount > 1_000_000_000) {
    return null;
  }
  return amount;
}

function expenseCategory(label) {
  if (/(?:커피|카페|음료|디저트|빵)/.test(label)) return '카페';
  if (/(?:버스|택시|지하철|기차|교통|주유|주차)/.test(label)) return '교통';
  if (/(?:쇼핑|옷|의류|신발|생활용품|쿠팡)/.test(label)) return '쇼핑';
  if (/(?:아침|점심|저녁|식사|밥|김밥|식비|마트|장보기|배달)/.test(label)) return '식비';
  return '기타';
}

function parseFinance(input, date) {
  const trailing = input.match(TRAILING_FINANCE);
  const prefixed = trailing ? null : input.match(PREFIX_FINANCE);
  if (!trailing && !prefixed) return null;

  const marker = trailing ? trailing[3] : prefixed[1];
  const label = (trailing ? trailing[1] : prefixed[2]).trim().replace(/[.!?]+$/, '').trim();
  const amountToken = trailing ? trailing[2] : prefixed[3];
  const amount = parseMoney(amountToken);
  if (
    !amount
    || !label
    || label.length > 80
    || MONEY_TOKEN_ANYWHERE.test(label)
    || /(?:지출|수입|kcal|칼로리|\d+\s*분)/i.test(label)
  ) return null;

  const kind = marker === '수입' ? 'income' : 'expense';
  const type = kind === 'income' ? 'deposit' : 'withdraw';
  const category = kind === 'income' ? '수입' : expenseCategory(label);
  const kindLabel = kind === 'income' ? '수입' : '지출';
  return result(
    kind,
    { type, amount, category, memo: label, date },
    `${label} · ${WON_FORMATTER.format(amount)}원을 ${kindLabel}로 기록할게요.`,
    [date, amount, category, label]
  );
}

function workoutMeta(value) {
  const activity = value.replace(/\s+/g, ' ').trim();
  if (/^(?:빠른\s*걷기|걷기|산책)$/.test(activity)) {
    return { title: '빠른 걷기', templateId: 'cardio', workoutKind: 'cardio', activityId: 'brisk-walk' };
  }
  if (activity === '조깅') return { title: '조깅', templateId: 'cardio', workoutKind: 'cardio', activityId: 'jogging' };
  if (/^(?:러닝|달리기)$/.test(activity)) return { title: '러닝', templateId: 'cardio', workoutKind: 'cardio', activityId: 'running' };
  if (activity === '자전거') return { title: '자전거', templateId: 'cardio', workoutKind: 'cardio', activityId: 'cycling' };
  if (activity === '일립티컬') return { title: '일립티컬', templateId: 'cardio', workoutKind: 'cardio', activityId: 'elliptical' };
  if (activity === '줄넘기') return { title: '줄넘기', templateId: 'cardio', workoutKind: 'cardio', activityId: 'jump-rope' };
  if (activity === '인터벌') return { title: '인터벌', templateId: 'cardio', workoutKind: 'cardio', activityId: 'interval' };
  if (activity === '스트레칭') return { title: '스트레칭', templateId: 'cardio', workoutKind: 'cardio', activityId: 'stretching' };
  if (/^(?:상체|푸시업|팔굽혀펴기)$/.test(activity)) {
    return { title: activity === '팔굽혀펴기' ? '푸시업' : activity, templateId: 'upper', workoutKind: 'strength', activityId: '' };
  }
  if (/^(?:하체|스쿼트|런지)$/.test(activity)) {
    return { title: activity, templateId: 'lower', workoutKind: 'strength', activityId: '' };
  }
  return { title: activity, templateId: 'other', workoutKind: 'strength', activityId: '' };
}

function parseWorkout(input, date) {
  const match = input.match(WORKOUT_LINE);
  if (!match) return null;
  const durationMinutes = Number(match[2]);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) return null;
  const meta = workoutMeta(match[1]);
  const draft = {
    templateId: meta.templateId,
    workoutKind: meta.workoutKind,
    title: meta.title,
    activity: meta.title,
    activityId: meta.activityId,
    durationMinutes,
    date
  };
  return result(
    'workout',
    draft,
    `${meta.title} ${durationMinutes}분을 운동으로 기록할게요.`,
    [date, meta.templateId, meta.title, durationMinutes]
  );
}

function parseIntegerToken(value) {
  const token = String(value || '').trim();
  if (token.includes(',') && !/^\d{1,3}(?:,\d{3})+$/.test(token)) return null;
  if (!/^\d[\d,]*$/.test(token)) return null;
  const number = Number(token.replaceAll(',', ''));
  return Number.isSafeInteger(number) ? number : null;
}

function parseDiet(input, date) {
  const match = input.match(DIET_LINE);
  if (!match) return null;
  const mealType = MEAL_TYPES[match[1]];
  const food = match[2].trim().replace(/[.!?]+$/, '').trim();
  const calories = parseIntegerToken(match[3]);
  if (
    !mealType
    || !food
    || food.length > 80
    || !calories
    || calories > 10000
    || MONEY_TOKEN_ANYWHERE.test(food)
    || /(?:지출|수입|kcal|칼로리|\d+\s*분)/i.test(food)
  ) return null;
  return result(
    'diet',
    { mealType, food, calories, date },
    `${MEAL_LABELS[mealType]} ${food} · ${WON_FORMATTER.format(calories)}kcal로 기록할게요.`,
    [date, mealType, food, calories]
  );
}

/**
 * Parses one explicit Korean LifeHub record line.
 *
 * Supported forms intentionally stay narrow:
 * - `메모: ...`
 * - `커피 4500원 지출` / `월급 300만원 수입`
 * - `러닝 30분`
 * - `점심 김밥 650kcal`
 *
 * Schedule creation remains owned by scheduleChatAction.js. A null return means
 * the caller must not create a personal record from the input.
 */
export function parseLifeRecordAction(text, { today } = {}) {
  const input = inputLine(text);
  if (!input || UI_CHANGE_REQUEST.test(input) || NEGATIVE_RECORD_REQUEST.test(input) || META_REQUEST.test(input)) {
    return null;
  }
  const date = validDateKey(today) ? today : localDateKey();

  const memo = parseMemo(input);
  if (memo) return memo;
  if (SCHEDULE_CREATE_REQUEST.test(input)) return null;

  const candidates = [
    parseFinance(input, date),
    parseWorkout(input, date),
    parseDiet(input, date)
  ].filter(Boolean);
  return candidates.length === 1 ? candidates[0] : null;
}
