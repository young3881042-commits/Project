import { useAssistantContext } from './useAssistantActions.js';
const labels = { waiting: '일정 요청 확인 중', prepared: '일정 저장 준비', saving: '저장 결과 확인 중', done: '일정 저장 완료', duplicate: '같은 일정이 이미 있어요', failed: '저장 확인 필요', conflict: '확인 필요', undoing: '되돌리는 중', undone: '일정 등록을 되돌렸어요', cancelled: '일정 요청 취소' };
export default function AssistantActionCard({ row }) {
  const assistant = useAssistantContext();
  if (!row || row.status === 'answered' || !row.expected?.actions?.length) return null;
  const item = row.item || row.expected.actions[0].draft;
  return <section className="orbitActionCard" aria-label="일정 처리 결과">
    <strong>{labels[row.status] || '확인 필요'}</strong>
    <p>{item.date} {item.time || '종일'} · {item.title}</p>
    {row.error ? <p role="alert">{row.error}</p> : null}
    {['done', 'duplicate'].includes(row.status) ? <p>일정에 저장됐어요. 알림은 설정되지 않았어요.</p> : null}
    <div>
      {row.item?.id ? <a href={`/schedule?edit=${encodeURIComponent(row.item.id)}`}>일정 열기</a> : null}
      {row.status === 'done' && Date.now() <= row.undoUntil ? <button type="button" onClick={() => assistant?.undo(row.id)}>되돌리기</button> : null}
      {row.status === 'failed' ? <button type="button" onClick={() => assistant?.retry(row.id)}>저장 다시 확인</button> : null}
    </div>
  </section>;
}
export function AssistantActivitySummary() {
  const assistant = useAssistantContext();
  const rows = (assistant?.rows || []).filter(r => r.expected?.actions?.length).slice(0, 3);
  if (!rows.length && !assistant?.error) return null;
  const attention = rows.filter(r => ['failed','conflict'].includes(r.status)).length;
  return <section className="orbitAssistantSummary" aria-label="개인비서 처리 내역">
    <h3>최근 처리한 일{attention ? ` · 확인 필요 ${attention}개` : ''}</h3>
    {assistant?.error ? <p role="status">{assistant.error}</p> : null}
    {rows.map(row => <AssistantActionCard key={row.id} row={row} />)}
    <a href="/ai">AI에서 요청하기</a>
  </section>;
}
