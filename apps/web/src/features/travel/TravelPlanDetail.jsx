import TravelDayMap from './TravelDayMap.jsx';
import { useRef, useState } from 'react';
export default function TravelPlanDetail({ plan, destination = '', owner = 'local', label = '여행 일정' }) {
  const [selected, setSelected] = useState(0);
  const tabs = useRef(null);
  const index = Math.min(selected, plan.days.length - 1), day = plan.days[index];
  function choose(next) { setSelected(next); tabs.current?.children[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  return <section className="orbitTravelPlan" aria-label={label}>
    <div className="orbitTravelDays" role="group" aria-label="여행 날짜 선택" ref={tabs}>
      {plan.days.map((item, i) => <button type="button" key={item.day} aria-pressed={index === i} onClick={() => choose(i)}>{item.day}일차<small>{item.date.slice(5).replace('-', '.')}</small></button>)}
    </div>
    <TravelDayMap key={JSON.stringify([owner, destination, plan.title, day])} day={day} title={plan.title} destination={destination} owner={owner} />
  </section>;
}
