const SCHEDULE_WORD = /(?:일정|약속)/;
const UI_EDIT_REQUEST = /(?:(?:일정|약속).{0,16}(?:버튼|화면|기능|컴포넌트|레이아웃).{0,16}(?:고쳐|수정|구현|개발|만들)|(?:버튼|화면|기능|컴포넌트|레이아웃|UI|UX).{0,16}(?:고쳐|수정|구현|개발))/i;
const NEGATIVE_WORD = /(?:추가하지\s*마|등록하지\s*마|만들지\s*마|취소해?\s*줘|취소할게)/;
const CREATE_END = /(?:(?:추가|등록|생성)(?:\s*좀)?\s*(?:(?:해)?\s*(?:줘|주세요|주라|줄래)|부탁해)|(?:만들|잡|넣)(?:어|아)?\s*(?:줘|주세요|주라|줄래))\s*[.!?~]*$/;
const REPEAT_HINT = /(?:매일|매주|매월|매년|매\s*요일|반복)/;
const REPEAT_MESSAGE = '반복 일정은 [일정 화면](/schedule?new=schedule)에서 요일과 종료일을 함께 설정해주세요.';
const WEEKDAYS = [
  { label: '월요일', index: 0 },
  { label: '화요일', index: 1 },
  { label: '수요일', index: 2 },
  { label: '목요일', index: 3 },
  { label: '금요일', index: 4 },
  { label: '토요일', index: 5 },
  { label: '일요일', index: 6 }
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateAtNoon(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function shiftDate(value, amount) {
  const date = dateAtNoon(value);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function validDateParts(year, month, day) {
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parseDate(text, today) {
  const relativeCount = ['오늘', '내일', '모레'].filter((word) => text.includes(word)).length;
  const absoluteCount = [
    /\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(text),
    /(?:(?:20\d{2})년\s*)?\d{1,2}월\s*\d{1,2}일/.test(text),
    /(?:이번|다음|다다음)\s*달\s*\d{1,2}일/.test(text),
    /(?:^|\s)\d{1,2}[/.]\d{1,2}(?=\s|$|[에,.!?])/.test(text)
  ].filter(Boolean).length;
  if (relativeCount > 1 || absoluteCount > 1 || (relativeCount && absoluteCount)) {
    return { status: 'invalid', message: '날짜가 두 개 이상 보여요. 하나의 날짜만 알려주세요.' };
  }
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const [, rawYear, rawMonth, rawDay] = iso;
    const year = Number(rawYear);
    const month = Number(rawMonth);
    const day = Number(rawDay);
    return validDateParts(year, month, day)
      ? { status: 'ready', date: `${year}-${pad(month)}-${pad(day)}` }
      : { status: 'invalid', message: '날짜를 다시 확인해주세요.' };
  }

  if (text.includes('모레')) return { status: 'ready', date: shiftDate(today, 2) };
  if (text.includes('내일')) return { status: 'ready', date: shiftDate(today, 1) };
  if (text.includes('오늘')) return { status: 'ready', date: today };

  const korean = text.match(/(?:(20\d{2})년\s*)?(\d{1,2})월\s*(\d{1,2})일/);
  if (korean) {
    const base = dateAtNoon(today);
    let year = korean[1] ? Number(korean[1]) : base.getFullYear();
    const month = Number(korean[2]);
    const day = Number(korean[3]);
    if (!validDateParts(year, month, day)) return { status: 'invalid', message: '날짜를 다시 확인해주세요.' };
    let result = `${year}-${pad(month)}-${pad(day)}`;
    if (!korean[1] && result < today) {
      year += 1;
      if (!validDateParts(year, month, day)) return { status: 'invalid', message: '날짜를 다시 확인해주세요.' };
      result = `${year}-${pad(month)}-${pad(day)}`;
    }
    return { status: 'ready', date: result };
  }

  const relativeMonth = text.match(/(이번|다음|다다음)\s*달\s*(\d{1,2})일/);
  if (relativeMonth) {
    const base = dateAtNoon(today);
    const monthOffset = relativeMonth[1] === '이번' ? 0 : relativeMonth[1] === '다음' ? 1 : 2;
    const targetMonth = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1, 12, 0, 0, 0);
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth() + 1;
    const day = Number(relativeMonth[2]);
    if (!validDateParts(year, month, day)) return { status: 'invalid', message: '날짜를 다시 확인해주세요.' };
    const result = `${year}-${pad(month)}-${pad(day)}`;
    if (result < today) return { status: 'invalid', message: '이번 달의 지난 날짜예요. 날짜를 다시 알려주세요.' };
    return { status: 'ready', date: result };
  }

  const short = text.match(/(?:^|\s)(\d{1,2})[/.](\d{1,2})(?=\s|$|[에,.!?])/);
  if (short) {
    const base = dateAtNoon(today);
    let year = base.getFullYear();
    const month = Number(short[1]);
    const day = Number(short[2]);
    if (!validDateParts(year, month, day)) return { status: 'invalid', message: '날짜를 다시 확인해주세요.' };
    let result = `${year}-${pad(month)}-${pad(day)}`;
    if (result < today) {
      year += 1;
      if (!validDateParts(year, month, day)) return { status: 'invalid', message: '날짜를 다시 확인해주세요.' };
      result = `${year}-${pad(month)}-${pad(day)}`;
    }
    return { status: 'ready', date: result };
  }

  const weekday = WEEKDAYS.find((item) => text.includes(item.label));
  if (weekday) {
    const base = dateAtNoon(today);
    const mondayIndex = (base.getDay() + 6) % 7;
    let offset;
    if (/다음\s*주/.test(text)) offset = 7 - mondayIndex + weekday.index;
    else if (/이번\s*주/.test(text)) offset = weekday.index - mondayIndex;
    else {
      offset = (weekday.index - mondayIndex + 7) % 7;
      if (offset === 0) offset = 7;
    }
    return { status: 'ready', date: shiftDate(today, offset) };
  }

  if (/(?:이번|다음|다다음)\s*달/.test(text)) {
    return { status: 'invalid', message: '몇 일인지 날짜를 함께 알려주세요.' };
  }

  return { status: 'ready', date: today };
}

function parseTime(text) {
  const namedTimeCount = (text.match(/(?:정오|자정)/g) || []).length;
  const clockTimeCount = [...text.matchAll(/\b\d{1,2}:\d{1,2}\b/g)].length;
  const koreanTimeCount = [...text.matchAll(/(?:오전|오후|아침|낮|저녁|밤)?\s*\d{1,2}시(?:\s*(?:반|\d{1,2}분))?/g)].length;
  if (namedTimeCount + clockTimeCount + koreanTimeCount > 1) {
    return { status: 'invalid', message: '시간이 두 개 이상 보여요. 하나의 시간만 알려주세요.' };
  }
  if (text.includes('정오')) return { status: 'ready', time: '12:00' };
  if (text.includes('자정')) return { status: 'ready', time: '00:00' };

  const clock = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?=\s|$|[에,.!?])/);
  if (clock) return { status: 'ready', time: `${pad(clock[1])}:${clock[2]}` };
  if (/\b\d{1,2}:\d{1,2}\b/.test(text)) return { status: 'invalid', message: '시간을 다시 확인해주세요.' };

  const korean = text.match(/(오전|오후|아침|낮|저녁|밤)?\s*(\d{1,2})시(?:\s*(반|\d{1,2}분))?/);
  if (!korean) return { status: 'ready', time: '' };
  const hour = Number(korean[2]);
  const minute = korean[3] === '반' ? 30 : Number(String(korean[3] || '0').replace('분', ''));
  const meridiem = korean[1] || '';
  if (hour < 1 || hour > 23 || minute < 0 || minute > 59 || (meridiem && hour > 12)) {
    return { status: 'invalid', message: '시간을 다시 확인해주세요.' };
  }
  if (!meridiem && hour <= 12) {
    return { status: 'need-more', hour, minute, question: `${hour}시는 오전인가요, 오후인가요?` };
  }
  let normalizedHour = hour % 24;
  if (meridiem === '밤' && hour === 12) normalizedHour = 0;
  if (!(meridiem === '밤' && hour === 12) && ['오후', '낮', '저녁', '밤'].includes(meridiem) && normalizedHour < 12) normalizedHour += 12;
  if (['오전', '아침'].includes(meridiem) && normalizedHour === 12) normalizedHour = 0;
  return { status: 'ready', time: `${pad(normalizedHour)}:${pad(minute)}` };
}

function titleFromText(text) {
  const quoted = text.match(/["'“”‘’]([^"'“”‘’]{1,80})["'“”‘’]/);
  if (quoted) return quoted[1].trim();
  let value = text
    .replace(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, ' ')
    .replace(/(?:(?:20\d{2})년\s*)?\d{1,2}월\s*\d{1,2}일/g, ' ')
    .replace(/(?:이번|다음|다다음)\s*달\s*\d{1,2}일/g, ' ')
    .replace(/(?:^|\s)\d{1,2}[/.]\d{1,2}(?=\s|$|[에,.!?])/g, ' ')
    .replace(/(?:오늘|내일|모레|이번\s*주|다음\s*주|월요일|화요일|수요일|목요일|금요일|토요일|일요일)/g, ' ')
    .replace(/(?:오전|오후|아침|낮|저녁|밤)?\s*\d{1,2}시(?:\s*(?:반|\d{1,2}분))?/g, ' ')
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d(?=\s|$|[에,.!?])/g, ' ')
    .replace(/(?:정오|자정)/g, ' ')
    .replace(/(?:내|제)\s*(?:일정|약속)(?:에|을|를)?/g, ' ')
    .replace(/(?:일정|약속)(?:에|을|를)?/g, ' ')
    .replace(/(?:하나|한\s*개)(?:만)?/g, ' ')
    .replace(/(?:추가|등록|생성)(?:\s*좀)?\s*(?:(?:해)?\s*(?:줘|주세요|주라|줄래)|부탁해)|(?:만들|잡|넣)(?:어|아)?\s*(?:줘|주세요|주라|줄래)/g, ' ')
    .replace(/(?:해\s*줘|해주세요|해줘|줘|주라)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:에|부터)\s+/, '')
    .replace(/(?:으로|로|을|를|에)$/g, '')
    .trim();
  if (/^테스트(?:용)?$/.test(value)) value = '테스트 일정';
  return value.slice(0, 80);
}

function categoryForTitle(title) {
  if (/(?:운동|헬스|러닝|걷기)/.test(title)) return 'exercise';
  if (/(?:회의|업무|작업|마감|출근)/.test(title)) return 'work';
  if (/(?:여행|비행|숙소|출국)/.test(title)) return 'travel';
  return 'etc';
}

export function parseScheduleCreateRequest(text, { today, pending = null } = {}) {
  const input = String(text || '').trim();
  const safeToday = /^20\d{2}-\d{2}-\d{2}$/.test(today || '') ? today : dateKey(new Date());

  if (pending) {
    if (/^(?:취소|그만|아니|됐어)/.test(input)) return { status: 'cancelled' };
    if (UI_EDIT_REQUEST.test(input)) return { status: 'not-action' };
    if (REPEAT_HINT.test(input)) return { status: 'invalid', message: REPEAT_MESSAGE };
    if (pending.missing === 'meridiem') {
      const meridiem = /(오전|아침)/.test(input) ? 'am' : /(오후|낮|저녁|밤)/.test(input) ? 'pm' : '';
      if (!meridiem) return { status: 'need-more', draft: pending.draft, missing: 'meridiem', question: '오전인지 오후인지 알려주세요.' };
      let hour = pending.draft.hour % 12;
      if (meridiem === 'pm' && !(/밤/.test(input) && pending.draft.hour === 12)) hour += 12;
      const { hour: _hour, minute: _minute, ...draft } = pending.draft;
      return { status: 'ready', draft: { ...draft, time: `${pad(hour)}:${pad(pending.draft.minute)}` } };
    }
    if (pending.missing === 'title') {
      const title = SCHEDULE_WORD.test(input) && CREATE_END.test(input)
        ? titleFromText(input)
        : input.replace(/["'“”‘’]/g, '').trim().slice(0, 80);
      if (!title) return { status: 'need-more', draft: pending.draft, missing: 'title', question: '어떤 일정인지 제목을 알려주세요.' };
      return { status: 'ready', draft: { ...pending.draft, title, category: categoryForTitle(title) } };
    }
  }

  if (!input || !SCHEDULE_WORD.test(input) || UI_EDIT_REQUEST.test(input) || NEGATIVE_WORD.test(input) || !CREATE_END.test(input)) {
    return { status: 'not-action' };
  }
  if (REPEAT_HINT.test(input)) {
    return { status: 'invalid', message: REPEAT_MESSAGE };
  }

  const date = parseDate(input, safeToday);
  if (date.status === 'invalid') return date;
  const time = parseTime(input);
  if (time.status === 'invalid') return time;
  const title = titleFromText(input);
  const baseDraft = {
    title,
    date: date.date,
    time: time.time || '',
    category: categoryForTitle(title)
  };
  if (time.status === 'need-more') {
    return {
      status: 'need-more',
      missing: 'meridiem',
      question: time.question,
      draft: { ...baseDraft, hour: time.hour, minute: time.minute }
    };
  }
  if (!title) {
    return { status: 'need-more', missing: 'title', question: '어떤 일정인지 제목을 알려주세요.', draft: baseDraft };
  }
  return { status: 'ready', draft: baseDraft };
}

export function scheduleConfirmationText(item, duplicate = false) {
  const date = String(item?.date || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1년 $2월 $3일');
  const time = item?.time ? ` ${item.time}` : ' 종일';
  const prefix = duplicate ? '같은 일정이 이미 있어요.' : '일정을 추가했어요.';
  return `${prefix}\n\n**${date}${time} · ${item?.title || '새 일정'}**\n\n[일정에서 확인하기](/schedule?edit=${encodeURIComponent(item?.id || '')})`;
}
