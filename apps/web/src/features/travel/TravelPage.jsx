import CodexConnection from '../ai-runtime/CodexConnection.jsx';
import { useEffect, useRef, useState } from 'react';
import TravelPlannerPage from '../../components/travel/TravelPlannerPage.jsx';
import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import { useTravelPlanner } from './useTravelPlanner.js';
import TravelPlanDetail from './TravelPlanDetail.jsx';
import { travelDateOffset, validateTravelPlan } from './travelModel.js';

export default function TravelPage({ model, owner, readTrips, saveTrips, refresh }) {
  const planner = useTravelPlanner({ owner, today: model.today });
  const [editing, setEditing] = useState(!planner.result);
  const resultHeading = useRef(null);
  useEffect(() => {
    if (planner.result) { setEditing(false); resultHeading.current?.scrollIntoView({ block: 'start' }); }
    else if (!planner.pending && !planner.submitting) setEditing(true);
  }, [planner.result, planner.pending, planner.submitting]);
  const [view, setView] = useState('plan');
  useEffect(() => { if (!editing && view === 'plan') resultHeading.current?.scrollIntoView({ block: 'start' }); }, [editing, view]);
  const [feedback, setFeedback] = useState('');
  const saved = model.trips.some(trip => trip.id === `trip-${planner.jobId}`);
  function persist(items, success) {
    const result = saveTrips(items);
    setFeedback(result.saved ? success : '저장하지 못했어요. 현재 내용은 그대로 두었어요.');
    if (result.saved) refresh();
    return result.saved;
  }
  function savePlan() {
    if (!planner.result || saved) return;
    try {
      const itinerary = validateTravelPlan(planner.result, planner.input);
      const id = `trip-${planner.jobId}`;
      persist([{ id, title: itinerary.title, startDate: planner.input.startDate, endDate: travelDateOffset(planner.input.startDate, planner.input.days - 1), memo: itinerary.summary, plannerInput: planner.input, itinerary, createdAt: new Date().toISOString() }, ...readTrips().filter(trip => trip.id !== id)], '내 여행에 저장했어요.');
    } catch (error) { setFeedback(error.message); }
  }
  return <div className="lifeHubPage orbitTravelPage">
    <div className="orbitTravelSwitch" role="group" aria-label="여행 화면 선택"><button type="button" aria-pressed={view === 'plan'} onClick={() => setView('plan')}>계획 만들기</button><button type="button" aria-pressed={view === 'saved'} onClick={() => setView('saved')}>내 여행 <span>{model.trips.length}</span></button></div>
    {feedback ? <p className="orbitTravelFeedback" role="status">{feedback}</p> : null}
    {view === 'plan' ? <>
      {planner.error ? <p className="orbitTravelError" role="alert">{planner.error}</p> : null}
      {planner.storageError ? <p className="orbitTravelError" role="alert">{planner.storageError}</p> : null}
      {editing && !planner.pending && !planner.submitting ? <><TravelPlannerPage draft={planner.draft} onChange={planner.change} onSubmit={planner.generate} onImportDraft={planner.importDraft} busy={planner.pending || planner.submitting} />{planner.result ? <button type="button" onClick={() => setEditing(false)}>작성한 일정으로 돌아가기</button> : null}</> : null}
      {planner.pending || planner.submitting ? <section className="orbitTravelGenerating" aria-label="여행 생성 진행 상태"><h2>{planner.input?.destination} 여행을 만들고 있어요</h2><p role="status">{planner.message || '여행 동선을 구성하고 있어요.'}</p><small>보통 1~3분 걸려요. 다른 탭을 보면서 기다려도 괜찮아요.</small><div>{planner.error ? <button type="button" onClick={planner.retry}>진행 상태 다시 확인</button> : null}<button type="button" disabled={planner.submitting} onClick={planner.cancel}>생성 취소</button></div></section> : planner.message && !planner.result ? <p className="orbitTravelFeedback" role="status">{planner.message}</p> : null}
      {planner.result && !editing ? <><div className="orbitTravelResultHeading" ref={resultHeading}><div><strong>{saved ? '저장한 일정' : '여행 일정 완성'}</strong><small>{planner.input.days}일 · {planner.input.people}명 · {planner.input.pace}</small></div><div><button type="button" onClick={() => setEditing(true)}>조건 수정</button><button type="button" className="primary" disabled={saved} onClick={savePlan}>{saved ? '저장됨' : '저장하기'}</button></div></div><TravelPlanDetail key={planner.jobId} plan={planner.result} owner={owner} destination={planner.input.destination} /></> : null}
      <details className="orbitTravelConnection">
        <summary><span className={`orbitTravelStatus ${planner.connection}`} aria-hidden="true" />연결 설정 <small>{planner.connection === 'connected' ? '연결됨' : planner.connection === 'ready' ? '자동 연결' : planner.connection === 'checking' ? '확인 중' : '연결 확인'}</small></summary>
        <CodexConnection onConnected={() => planner.connect('')} />
      </details>
    </> : <section className="orbitTravelSaved" aria-label="저장한 여행">
      {model.trips.length ? model.trips.map(trip => {
        let itinerary = null;
        try { if (trip.itinerary) itinerary = validateTravelPlan(trip.itinerary, trip.plannerInput); } catch { /* Older checklists stay usable even if an itinerary is invalid. */ }
        return <article className="orbitTravelSavedCard" key={trip.id}><header><div><small>{[trip.startDate, trip.endDate].filter(Boolean).join(' — ') || '날짜 미정'}</small><h2>{trip.title}</h2></div><button type="button" aria-label={`${trip.title} 삭제`} onClick={() => { if (window.confirm('이 여행을 삭제할까요? 삭제 전 JSON 백업으로 보관할 수 있어요.')) persist(readTrips().filter(item => item.id !== trip.id), '여행을 삭제했어요.'); }}>삭제</button></header><p>{trip.memo}</p><div className="orbitTravelChecks">{(trip.checklist || []).map(check => <label key={check.id}><input type="checkbox" checked={check.done} onChange={() => persist(readTrips().map(item => item.id === trip.id ? { ...item, checklist: item.checklist.map(current => current.id === check.id ? { ...current, done: !current.done } : current) } : item), '준비 상태를 저장했어요.')} /><span>{check.text}</span></label>)}</div>{itinerary ? <details><summary>날짜별 일정 보기</summary><TravelPlanDetail plan={itinerary} owner={owner} destination={trip.plannerInput?.destination} /></details> : trip.itinerary ? <p>일정 형식을 읽지 못했어요. 기존 메모와 준비 목록은 그대로 남아 있어요.</p> : null}</article>;
      }) : <div className="orbitTravelEmpty"><MemoNavIcon type="trip" /><h2>다음 여행이 기다리고 있어요</h2><p>생성한 일정을 저장하면 여기서 다시 볼 수 있어요.</p><button type="button" onClick={() => setView('plan')}>첫 여행 계획하기</button></div>}
    </section>}
  </div>;
}
