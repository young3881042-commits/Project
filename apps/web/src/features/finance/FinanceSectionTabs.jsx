import MemoNavIcon from '../../components/MemoNavIcon.jsx';

export const FINANCE_SECTION_IDS = Object.freeze([
  'ledger',
  'manual',
  'automation',
  'manage'
]);

const FINANCE_SECTIONS = Object.freeze([
  Object.freeze({ id: 'ledger', label: '내역', description: '조회', icon: 'list' }),
  Object.freeze({ id: 'manual', label: '수동 입력', description: '수입·지출', icon: 'edit' }),
  Object.freeze({ id: 'automation', label: '자동 기록', description: '결제·정기', icon: 'bell' }),
  Object.freeze({ id: 'manage', label: '분류·공유', description: '설정·파일', icon: 'settings' })
]);

function nextSectionIndex(key, currentIndex) {
  if (key === 'Home') return 0;
  if (key === 'End') return FINANCE_SECTIONS.length - 1;
  if (key === 'ArrowRight') return (currentIndex + 1) % FINANCE_SECTIONS.length;
  if (key === 'ArrowLeft') {
    return (currentIndex - 1 + FINANCE_SECTIONS.length) % FINANCE_SECTIONS.length;
  }
  return -1;
}

export function normalizeFinanceSection(value) {
  return FINANCE_SECTION_IDS.includes(value) ? value : FINANCE_SECTION_IDS[0];
}

export default function FinanceSectionTabs({ active, onChange }) {
  const activeSection = normalizeFinanceSection(active);

  const selectFromKeyboard = (event, currentIndex) => {
    const index = nextSectionIndex(event.key, currentIndex);
    if (index < 0) return;
    event.preventDefault();
    const next = FINANCE_SECTIONS[index];
    onChange?.(next.id);
    event.currentTarget.parentElement?.querySelectorAll('button')?.[index]?.focus();
  };

  return (
    <div className="lifeHubFinanceWorkspace">
      <nav className="lifeHubFinanceTabs" aria-label="가계부 내부 메뉴">
        {FINANCE_SECTIONS.map((section, index) => {
          const selected = section.id === activeSection;
          return (
            <button
              type="button"
              key={section.id}
              aria-pressed={selected}
              className={selected ? 'active' : ''}
              onClick={() => onChange?.(section.id)}
              onKeyDown={(event) => selectFromKeyboard(event, index)}
            >
              <MemoNavIcon type={section.icon} />
              <strong>{section.label}</strong>
              <small>{section.description}</small>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
