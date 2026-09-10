import { TRAVEL_INTERESTS, TRAVEL_PACES, travelDateOffset, validTravelDate } from '../../features/travel/travelModel.js';

export default function TravelPlannerPage({ draft, onChange, onSubmit, onImportDraft, busy }) {
  const endDate = validTravelDate(draft.startDate) ? travelDateOffset(draft.startDate, Number(draft.days) - 1).slice(5).replace('-', '.') : '';
  return <form className="orbitTravelForm" onSubmit={onSubmit}>
    <header><h2>어디로 떠날까요?</h2><p>여행지와 날짜부터 정해보세요.</p></header>
    <fieldset disabled={busy}>
      <label htmlFor="travel-destination"><span><span aria-hidden="true">📍</span> 여행지</span><input id="travel-destination" value={draft.destination} maxLength={100} required placeholder="도시나 지역을 입력하세요" autoComplete="off" onChange={event => onChange('destination', event.target.value)} /></label>
      <div className="orbitTravelTwoCol">
        <label htmlFor="travel-start"><span><span aria-hidden="true">📅</span> 출발일</span><input id="travel-start" type="date" min="2000-01-01" max="2099-12-01" required value={draft.startDate} onChange={event => onChange('startDate', event.target.value)} /></label>
        <label htmlFor="travel-days"><span><span aria-hidden="true">🗓️</span> 여행 기간</span><select id="travel-days" value={draft.days} onChange={event => onChange('days', Number(event.target.value))}>{Array.from({ length: 14 }, (_, i) => <option key={i} value={i + 1}>{i === 0 ? '당일 여행' : `${i}박 ${i + 1}일`}</option>)}</select></label>
      </div>
      {endDate ? <p className="orbitTravelDateHint">{draft.startDate.slice(5).replace('-', '.')} 출발 · {endDate}까지</p> : null}
      <div className="orbitTravelPeople"><label htmlFor="travel-people"><span aria-hidden="true">👥</span> 함께 가는 인원</label><div className="orbitTravelStepper">
        <button type="button" aria-label="인원 줄이기" disabled={Number(draft.people) <= 1} onClick={() => onChange('people', Math.max(1, (Number(draft.people) || 1) - 1))}>−</button>
        <input id="travel-people" type="number" inputMode="numeric" min={1} max={20} required value={draft.people} onChange={event => onChange('people', event.target.value)} /><span aria-hidden="true">명</span>
        <button type="button" aria-label="인원 늘리기" disabled={Number(draft.people) >= 20} onClick={() => onChange('people', Math.min(20, (Number(draft.people) || 1) + 1))}>＋</button>
      </div></div>
      <div className="orbitTravelPace" role="group" aria-label="여행 속도"><span><span aria-hidden="true">🌿</span> 어떤 여행을 원하세요?</span><div>{TRAVEL_PACES.map(pace => <button type="button" key={pace} aria-pressed={draft.pace === pace} onClick={() => onChange('pace', pace)}>{pace}</button>)}</div></div>
      <details className="orbitTravelPreferences"><summary><span aria-hidden="true">✨</span> 취향 · 요청사항 <small>{draft.interests.length || draft.requests ? '입력됨' : '선택'}</small></summary>
        <div className="orbitTravelInterests" role="group" aria-label="여행 취향">{TRAVEL_INTERESTS.map(interest => <button key={interest} type="button" aria-pressed={draft.interests.includes(interest)} onClick={() => onChange('interests', draft.interests.includes(interest) ? draft.interests.filter(item => item !== interest) : [...draft.interests, interest])}>{interest}</button>)}</div>
        <label htmlFor="travel-requests">꼭 반영할 내용<textarea id="travel-requests" maxLength={2000} rows={3} value={draft.requests} placeholder="예산, 숙소 위치, 꼭 갈 곳, 출발·도착 시간" onChange={event => onChange('requests', event.target.value)} /></label>
      </details>
      <p className="orbitTravelHours"><span aria-hidden="true">🕙</span><span><strong>매일 10:00 – 22:00</strong><small>식사와 휴식 시간을 포함해 일정을 만들어요.</small></span></p>
      <button className="primary orbitTravelGenerate" type="submit">{busy ? '여행을 만들고 있어요…' : '여행 일정 만들기'}</button>
      <small className="orbitTravelFormHint">네이버 한국어 자료를 우선 참고해요. 완성된 일정은 확인 후 저장하세요.</small>
      <button className="orbitTravelImport" type="button" onClick={onImportDraft}>이전 초안 불러오기</button>
    </fieldset>
  </form>;
}
