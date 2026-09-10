import { EFFORT_LABELS, mainQuotaWindows } from './chatModelOptions.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { travelApi } from '../travel/travelApi.js';
export function quotaWindowLabel(minutes, kind) {
  if (minutes === 10080) return '주간';
  if (minutes && minutes % 60 === 0) return `${minutes / 60}시간`;
  return minutes ? `${minutes}분` : kind === 'primary' ? '기본 한도' : '추가 한도';
}
export default function ChatModelControls({ model, onModel, effort, onEffort, disabled, revision }) {
  const [info, setInfo] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const live = useRef(true), lock = useRef(false);
  const refresh = useCallback(async () => {
    if (lock.current || document.visibilityState === 'hidden') return;
    lock.current = true; setLoading(true); setError('');
    try { const value = await travelApi('auth-info'); if (live.current) setInfo(value); }
    catch (failure) { if (live.current) setError(failure.message); }
    finally { lock.current = false; if (live.current) setLoading(false); }
  }, []);
  useEffect(() => { live.current = true; refresh(); return () => { live.current = false; }; }, [refresh, revision]);
  const models = info?.models || [], limits = info?.limits || [];
  const chosen = models.find(item => item.id === model);
  const efforts = chosen?.efforts || [];
  const quotaWindows = mainQuotaWindows(limits);
  return <div className="orbitChatModelControls">
    <label><span className="srOnly">AI 모델</span><select aria-label="AI 모델" value={model} disabled={disabled} onChange={event => onModel(event.target.value)}>
      <option value="">자동 모델</option>
      {model && !models.some(item => item.id === model) ? <option value={model}>{model}</option> : null}
      {models.map(item => <option key={item.id} value={item.id}>{item.name}{item.isDefault ? ' · 기본' : ''}</option>)}
    </select></label>
    <label><span className="srOnly">추론 강도</span><select aria-label="추론 강도" value={effort || ''} disabled={disabled || !model} onChange={event => onEffort(event.target.value)}>
      <option value="">{chosen?.defaultEffort ? `기본 · ${EFFORT_LABELS[chosen.defaultEffort]}` : '기본 추론'}</option>
      {effort && !efforts.includes(effort) ? <option value={effort}>{EFFORT_LABELS[effort] || effort} · 재확인 필요</option> : null}
      {efforts.map(value => <option value={value} key={value}>{EFFORT_LABELS[value]}</option>)}
    </select></label>
    <details className="orbitChatQuota"><summary aria-label="5시간·주간 사용 한도 상세">
      {quotaWindows.map(({ label, limit }) => <span key={label}>{label} <b>{limit ? `${Math.floor(limit.remainingPercent)}% 남음` : loading ? '확인 중…' : '확인 불가'}</b></span>)}
    </summary>
      <div>
        <strong>계정 사용 한도</strong>
        <p>남은 토큰 개수는 제공되지 않아 사용 한도 잔여율을 표시해요. 선택한 모델의 개별 한도와 다를 수 있어요.</p>
        {limits.map((limit, index) => <section key={`${limit.bucket}:${limit.kind}:${index}`}>
          <span>{limit.bucket} · {quotaWindowLabel(limit.windowMinutes, limit.kind)}</span><b>{Math.floor(limit.remainingPercent)}% 남음</b>
          <progress aria-label={`${limit.bucket} ${quotaWindowLabel(limit.windowMinutes, limit.kind)} 잔여 한도`} max="100" value={limit.remainingPercent} />
          {limit.resetsAt ? <small>{new Date(limit.resetsAt * 1000).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 초기화 예정</small> : null}
        </section>)}
        {!limits.length ? <p>{info?.limitsError || '아직 사용 한도를 제공받지 못했어요.'}</p> : null}
        {error || info?.modelsError ? <p role="status">{error || info.modelsError}</p> : null}
        {info?.fetchedAt ? <small>{new Date(info.fetchedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 확인 기준</small> : null}
        <button type="button" disabled={loading} onClick={refresh}>모델·한도 새로고침</button>
      </div>
    </details>
  </div>;
}
