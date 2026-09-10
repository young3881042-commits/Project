import MemoNavIcon from '../../components/MemoNavIcon.jsx';

export const HOME_QUICK_ACTIONS = [
  { label: '일정 추가', icon: 'calendar', path: '/schedule?new=schedule' },
  { label: '메모 쓰기', icon: 'edit', path: '/memo?new=memo' },
  { label: '지출 기록', icon: 'chart', path: '/finance?new=entry' }
];

export default function HomeQuickActions({ navigate }) {
  return <nav className="orbitHomeQuickActions" aria-label="빠른 기록">
    {HOME_QUICK_ACTIONS.map(item => <button type="button" key={item.path} onClick={() => navigate(item.path)}>
      <span aria-hidden="true"><MemoNavIcon type={item.icon} /></span>
      <strong>{item.label}</strong>
    </button>)}
  </nav>;
}
