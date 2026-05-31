import MemoNavIcon from '../MemoNavIcon.jsx';

export default function MobileHomeSection({ id, title, count, expanded, onToggle, action, children }) {
  return (
    <section className={`notesMobileAccordion ${expanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="notesMobileAccordionToggle"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
      >
        <span>
          <strong>{title}</strong>
          {typeof count === 'number' ? <small>{count}개</small> : null}
        </span>
        <MemoNavIcon type="chevronRight" />
      </button>
      {expanded ? (
        <div className="notesMobileAccordionPanel">
          {action}
          {children}
        </div>
      ) : null}
    </section>
  );
}
