const LIFEHUB_ICON_BASE = '/assets/lifehub-icons';

const LIFEHUB_PACK_ICONS = {
  helper: 'helper.webp',
  home: 'home.webp',
  memo: 'memo.webp',
  calendar: 'calendar.webp',
  more: 'more.webp',
  workout: 'workout.webp',
  budget: 'budget.webp',
  work: 'work.webp',
  habit: 'habit.webp'
};

export const LIFEHUB_APP_ICON = `${LIFEHUB_ICON_BASE}/app-icon-192.png`;

export default function LifeHubPackIcon({ name, className = '' }) {
  const filename = LIFEHUB_PACK_ICONS[name] || LIFEHUB_PACK_ICONS.helper;
  return (
    <img
      className={`lifeHubPackIcon ${className}`.trim()}
      src={`${LIFEHUB_ICON_BASE}/${filename}`}
      alt=""
      aria-hidden="true"
      loading="lazy"
    />
  );
}
