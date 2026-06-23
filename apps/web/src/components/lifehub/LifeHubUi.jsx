import { useEffect, useState } from 'react';
import MemoNavIcon from '../MemoNavIcon.jsx';

export function LifeHubButton({ children, className = '', icon, type = 'button', ...props }) {
  return (
    <button type={type} className={`lifeHubButton ${className}`.trim()} {...props}>
      {icon ? <MemoNavIcon type={icon} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function useLifeHubFeedback() {
  const [feedback, setFeedback] = useState(null);

  const notify = (message, tone = 'success') => {
    setFeedback({ id: Date.now(), message, tone });
  };

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  return { feedback, notify, clearFeedback: () => setFeedback(null) };
}

export function FeedbackToast({ feedback, onClose }) {
  if (!feedback) return null;
  return (
    <div className={`lifeHubToast ${feedback.tone || 'success'}`} role="status">
      <span>{feedback.message}</span>
      <button type="button" onClick={onClose} aria-label="알림 닫기">
        <MemoNavIcon type="close" />
      </button>
    </div>
  );
}

export function EmptyState({ title, text, action, actionLabel, icon = 'spark', onAction }) {
  return (
    <div className="lifeHubEmpty">
      <MemoNavIcon type={icon} />
      <strong>{title}</strong>
      {text ? <p>{text}</p> : null}
      {action || (actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null)}
    </div>
  );
}

export function QuickChoiceGroup({ label, options, value, onChange, className = '' }) {
  return (
    <div className={`lifeHubChoiceGroup ${className}`.trim()} aria-label={label}>
      {label ? <span>{label}</span> : null}
      <div>
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          return (
            <button
              type="button"
              key={item.value}
              className={value === item.value ? 'active' : ''}
              onClick={() => onChange(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Section({ title, eyebrow, action, children, className = '' }) {
  return (
    <section className={`lifeHubSection ${className}`.trim()}>
      <header className="lifeHubSectionHeader">
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
