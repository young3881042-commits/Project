import TravelDayMap from './TravelDayMap.jsx';
import { useRef, useState } from 'react';
import { publicTravelSource } from './travelModel.js';

export default function TravelPlanDetail({ plan, destination = '', label = '여행 일정' }) {
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const tabs = useRef(null);
  const day = plan.days[Math.min(selected, plan.days.length - 1)];
  function choose(index) {
    setSelected(index);
    tabs.current?.children[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  return <section className="orbitTravelPlan" aria-label={label}>
    <header><h2><span aria-hidden="true">🧳</span> {plan.title}</h2><details className="orbitTravelOverview"><summary>여행 전체 소개</summary><p>{plan.summary}</p></details></header>
    <div className="orbitTravelDays" role="group" aria-label="여행 날짜 선택" ref={tabs}>
      {plan.days.map((item, index) => <button type="button" key={item.day} aria-pressed={selected === index} onClick={() => choose(index)}>{item.day}일차<small>{item.date.slice(5).replace('-', '.')}</small></button>)}
    </div>
    <div className="orbitTravelDayHeading"><h3 className="orbitTravelDayTitle">{day.title}</h3><span>{day.items.length}곳</span></div>
    <TravelDayMap key={day.day} day={day} title={plan.title} destination={destination} />
    <div className="orbitTravelReading"><p className="orbitTravelReadHint">장소를 누르면 자세히 볼 수 있어요.</p><button type="button" aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '모두 접기' : '모두 펼치기'}</button></div>
    <ol className="orbitTravelTimeline" key={day.day}>
      {day.items.map((item, index) => <li key={`${item.time}-${index}`}><time>{item.time}</time><details className="orbitTravelStop" open={expanded}><summary><strong><span className="orbitTravelStopEmoji" aria-hidden="true">📍</span>{item.title}</strong><span>{item.place}</span></summary><p>{item.description}</p>{item.transport ? <p className="orbitTravelStopMeta"><b>🚶 이동</b>{item.transport}</p> : null}{item.estimatedCost ? <p className="orbitTravelStopMeta"><b>💳 예상 비용</b>{item.estimatedCost}</p> : null}</details></li>)}
    </ol>
    {plan.days.length > 1 ? <div className="orbitTravelDayPager"><button type="button" disabled={selected === 0} onClick={() => choose(selected - 1)}>← 이전 날</button><span>{selected + 1} / {plan.days.length}일</span><button type="button" disabled={selected === plan.days.length - 1} onClick={() => choose(selected + 1)}>다음 날 →</button></div> : null}
    <p className="orbitTravelNotice">AI가 만든 초안이에요. 방문 전 영업시간·가격·이동 시간을 확인해주세요.</p>
    {plan.tips.length || plan.sources.length ? <details className="orbitTravelReferences"><summary>💡 여행 팁과 참고 자료</summary><ul>{plan.tips.map((tip, i) => <li key={i}>{tip}</li>)}</ul>{plan.sources.filter(item => publicTravelSource(item.url)).map((source, i) => <p key={i}><span>{source.title}</span><br /><small className="orbitTravelSource">{source.url}</small></p>)}<small>참고 주소는 길게 눌러 복사할 수 있어요.</small></details> : null}
  </section>;
}
