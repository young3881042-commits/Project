const PHASE_LABELS = {
  idle: '요청 대기',
  'awaiting-approval': '승인 필요',
  planning: '요청 분석',
  working: '수정 진행',
  executing: '테스트·명령 실행',
  editing: '파일 변경 확인',
  finalizing: '결과 정리',
  completed: '완료',
  failed: '확인 필요'
};

const OUTCOME_LABELS = {
  idle: '대기',
  attention: '승인 필요',
  'in-progress': '진행 중',
  success: '완료',
  partial: '일부 확인 필요',
  failure: '실패'
};

function fallbackSteps(progress) {
  const current = progress.phase;
  const order = ['planning', 'editing', 'executing', 'finalizing'];
  let activeIndex = 0;
  if (['working', 'editing'].includes(current)) activeIndex = 1;
  if (current === 'executing') activeIndex = 2;
  if (current === 'finalizing') activeIndex = 3;
  if (current === 'completed') activeIndex = order.length;
  if (current === 'failed') {
    activeIndex = progress.commandCount ? 2 : progress.fileCount ? 1 : 0;
  }
  return [
    { id: 'request', text: '수정 요청 분석' },
    { id: 'edit', text: '앱·웹 파일 수정' },
    { id: 'verify', text: '테스트와 변경 확인' },
    { id: 'result', text: '결과 요약 정리' }
  ].map((step, index) => ({
    ...step,
    status: current === 'failed' && index === activeIndex
      ? 'failed'
      : index < activeIndex ? 'completed' : index === activeIndex && !['idle', 'awaiting-approval'].includes(current) ? 'in-progress' : 'pending'
  }));
}

function statusSymbol(status) {
  if (status === 'completed') return '✓';
  if (status === 'failed') return '!';
  if (status === 'skipped') return '–';
  if (status === 'in-progress') return '•';
  return '';
}

export default function AppEditorProgressPanel({ progress }) {
  const hasBridgeTodos = progress.todos.length > 0;
  const steps = hasBridgeTodos ? progress.todos : fallbackSteps(progress);
  const busy = progress.outcome === 'in-progress';

  return (
    <section className={`lifeHubAppEditorProgress ${progress.outcome}`} aria-labelledby="app-editor-progress-title">
      <header>
        <div>
          <span>Bridge 실시간 이벤트</span>
          <h4 id="app-editor-progress-title">실시간 진행 체크</h4>
        </div>
        <em>{OUTCOME_LABELS[progress.outcome] || progress.outcome}</em>
      </header>

      <div className="lifeHubAppEditorActivity" role="status" aria-live="polite" aria-atomic="true">
        <span>{PHASE_LABELS[progress.phase] || progress.phase}</span>
        <strong>{progress.currentActivity}</strong>
      </div>

      {progress.percent !== null ? (
        <div className="lifeHubAppEditorProgressBar">
          <div>
            <span>할 일 {progress.completedTodoCount}/{progress.totalTodoCount}</span>
            <strong>{progress.percent}%</strong>
          </div>
          <progress max="100" value={progress.percent} aria-label="앱 수정 작업 진행률">{progress.percent}%</progress>
        </div>
      ) : (
        <div className={`lifeHubAppEditorIndeterminate ${busy ? 'busy' : ''}`}>
          <span aria-hidden="true"><i /></span>
          <small>{busy ? 'Codex 작업 이벤트를 실시간으로 받고 있어요.' : '작업이 시작되면 단계별 상태가 여기에 표시돼요.'}</small>
        </div>
      )}

      <ol className={`lifeHubAppEditorChecklist ${hasBridgeTodos ? 'bridge-todos' : 'fallback'}`} aria-label={hasBridgeTodos ? 'Codex 작업 체크리스트' : '앱 수정 기본 단계'}>
        {steps.map((step) => (
          <li key={step.id} className={step.status}>
            <span aria-hidden="true">{statusSymbol(step.status)}</span>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>

      <dl className="lifeHubAppEditorResultFacts" aria-label="현재 작업 결과 요약">
        <div><dt>변경 파일</dt><dd>{progress.fileCount}개</dd></div>
        <div><dt>명령 성공</dt><dd>{progress.successfulCommandCount}/{progress.commandCount}</dd></div>
        <div><dt>명령 실패</dt><dd>{progress.failedCommandCount}개</dd></div>
        <div><dt>결과 설명</dt><dd>{progress.hasFinalResult ? '도착' : '대기'}</dd></div>
      </dl>
    </section>
  );
}
