export const EFFORT_LABELS = Object.freeze({ none: '없음', minimal: '최소', low: '가볍게 · Low', medium: '균형 · Medium', high: '깊게 · High', xhigh: '더 깊게 · Extra High', max: '최대 · Max', ultra: '울트라 · Ultra' });
export const validChatEffort = value => typeof value === 'string' && (value === '' || Object.hasOwn(EFFORT_LABELS, value));
export function modelEfforts(item) {
  return [...new Set((Array.isArray(item?.supportedReasoningEfforts) ? item.supportedReasoningEfforts : []).map(row => row?.reasoningEffort).filter(value => value && validChatEffort(value)))];
}
export function mainQuotaWindows(limits = []) {
  const preferred = (limits.find(row => row.bucket?.toLowerCase() === 'codex') || limits.find(row => row.windowMinutes === 300) || limits.find(row => row.windowMinutes === 10080))?.bucket;
  return [300, 10080].map(minutes => ({ label: minutes === 300 ? '5시간' : '주간', limit: limits.find(row => row.windowMinutes === minutes && (!preferred || row.bucket === preferred)) }));
}
