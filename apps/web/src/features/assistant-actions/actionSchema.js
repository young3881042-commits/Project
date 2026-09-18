import { isDateKey } from '../../utils/lifeHubFormatters.js';
import { parseScheduleCreateRequest } from '../lifehub-ai/scheduleChatAction.js';

export const SCHEDULE_ACTION_CAPABILITY = 'schedule-create-v1';
const blocked = /(?:첨부|사진|문서|파일|추출|요약|코드|버튼|컴포넌트|UI|UX|파서|예시|예제|방법|라고\s*(?:말|쓰)|하지\s*마|하지\s*말|취소|등록하면|추가하면)/i;
const dateHint = /오늘|내일|모레|요일|\d{1,2}월|20\d{2}[-/.]|\d{1,2}[/.]\d{1,2}|이번\s*달|다음\s*달/;
export function scheduleIntent(text, today, pending = null) {
  const input = String(text || '').trim();
  if (blocked.test(input)) return { status: 'not-action' };
  if (pending && /^(?:오전|오후|아침|저녁|밤)(?:이야|으로|요|입니다)?[.!\s]*$/.test(input)) {
    return parseScheduleCreateRequest(input, { today, pending });
  }
  if (!/(?:등록|추가|넣어|잡아|만들어)/.test(input) || !/(?:일정|약속|회의|미팅|진료|예약)/.test(input)) return { status: 'not-action' };
  if (!dateHint.test(input)) return { status: 'invalid', message: '언제 할 일정인가요? 날짜와 제목을 함께 알려주세요.' };
  const parsed = parseScheduleCreateRequest(/일정|약속/.test(input) ? input : `일정 ${input}`, { today });
  if (parsed.status === 'ready' && !parsed.draft.time && !/종일/.test(input)) return { status: 'invalid', message: '시간이나 종일 여부를 포함해 일정을 다시 알려주세요.' };
  if (parsed.draft?.title) parsed.draft.title = parsed.draft.title.replace(/종일/g, '').trim();
  if (parsed.status === 'ready' && !parsed.draft.title) return { status: 'invalid', message: '제목을 포함해 날짜·시간과 함께 다시 알려주세요.' };
  return parsed;
}
export function validateActionContext(value) {
  if (value == null) return null;
  if (value.version !== 1 || !isDateKey(value.today) || typeof value.timeZone !== 'string' || value.timeZone.length > 80) throw new Error('일정 요청 기준을 확인해주세요.');
  let pending = null;
  if (value.pending != null) {
    const p = value.pending;
    if (p.missing !== 'meridiem' || typeof p.draft?.title !== 'string' || p.draft.title.length > 80 || !isDateKey(p.draft.date) || !Number.isInteger(p.draft.hour) || p.draft.hour < 1 || p.draft.hour > 12 || !Number.isInteger(p.draft.minute) || p.draft.minute < 0 || p.draft.minute > 59) throw new Error('추가 질문의 기준을 확인해주세요.');
    pending = { missing: 'meridiem', draft: { title: p.draft.title, date: p.draft.date, hour: p.draft.hour, minute: p.draft.minute, category: p.draft.category || 'etc' } };
  }
  return { version: 1, today: value.today, timeZone: value.timeZone, pending };
}
export function scheduleActionReply(text, context) {
  if (!context) return null;
  const result = scheduleIntent(text, context.today, context.pending);
  if (result.status === 'not-action') return null;
  if (result.status !== 'ready') return { reply: result.question || result.message || '날짜·시간·제목을 다시 알려주세요.', actions: [], clarification: result.status === 'need-more' && result.missing === 'meridiem' ? { missing: result.missing, draft: result.draft } : null };
  return { reply: '요청한 일정을 확인했어요. 실제 저장 결과는 아래 카드에서 확인하세요.', actions: [{ type: 'schedule.create', draft: result.draft }], clarification: null };
}
