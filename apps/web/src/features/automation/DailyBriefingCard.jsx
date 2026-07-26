import { useEffect, useState } from 'react';
import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import { buildDailyBriefing } from './dailyBriefing.js';

function requestedBriefingPeriod() {
  try {
    const period = new URLSearchParams(globalThis.location?.search || '').get('briefing');
    return period === 'morning' || period === 'evening' ? period : '';
  } catch {
    return '';
  }
}

export default function DailyBriefingCard({ model, navigate }) {
  const [period, setPeriod] = useState(() => (
    requestedBriefingPeriod() || (new Date().getHours() < 17 ? 'morning' : 'evening')
  ));
  const briefing = buildDailyBriefing(model, { period });

  useEffect(() => {
    const syncRequestedPeriod = () => {
      const requested = requestedBriefingPeriod();
      if (requested) setPeriod(requested);
    };
    syncRequestedPeriod();
    globalThis.addEventListener?.('popstate', syncRequestedPeriod);
    return () => globalThis.removeEventListener?.('popstate', syncRequestedPeriod);
  }, []);

  return (
    <section className="lifeHubBriefingCard" aria-labelledby="lifeHubBriefingTitle">
      <header>
        <div>
          <span>{briefing.eyebrow}</span>
          <h2 id="lifeHubBriefingTitle">{briefing.title}</h2>
        </div>
        <div role="group" aria-label="브리핑 시간대">
          <button type="button" className={period === 'morning' ? 'active' : ''} aria-pressed={period === 'morning'} onClick={() => setPeriod('morning')}>아침</button>
          <button type="button" className={period === 'evening' ? 'active' : ''} aria-pressed={period === 'evening'} onClick={() => setPeriod('evening')}>저녁</button>
        </div>
      </header>
      <p>{briefing.summary}</p>
      <div className="lifeHubBriefingItems">
        {briefing.items.map((item) => (
          <button type="button" key={item.label} onClick={() => navigate(item.route)}>
            <MemoNavIcon type={item.icon} />
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
            <em>{item.value}</em>
          </button>
        ))}
      </div>
    </section>
  );
}
