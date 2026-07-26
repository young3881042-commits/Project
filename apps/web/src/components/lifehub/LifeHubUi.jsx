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
    if (feedback.tone === 'error') return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 4200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  return { feedback, notify, clearFeedback: () => setFeedback(null) };
}

export function FeedbackToast({ feedback, onClose }) {
  if (!feedback) return null;
  return (
    <div
      className={`lifeHubToast ${feedback.tone || 'success'}`}
      role={feedback.tone === 'error' ? 'alert' : 'status'}
      aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
    >
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
    <div className={`lifeHubChoiceGroup ${className}`.trim()} role="group" aria-label={label}>
      {label ? <span>{label}</span> : null}
      <div>
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          return (
            <button
              type="button"
              key={item.value}
              className={value === item.value ? 'active' : ''}
              aria-pressed={value === item.value}
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

export function MemoStickyCard({ title, body, dateLabel, tags = [], pinned = false, onEdit, onPin, onDelete }) {
  return (
    <article className={pinned ? 'memo-sticky-card memo-pinned-card pinned' : 'memo-sticky-card'}>
      <header>
        <strong>{title}</strong>
        <div className="lifeHubCardActions">
          <button type="button" onClick={onEdit} aria-label={`${title} 수정`}>
            수정
          </button>
          <button type="button" onClick={onPin} aria-label={`${title} 고정 상태 변경`}>
            {pinned ? '고정됨' : '고정'}
          </button>
          <button type="button" className="quiet" onClick={onDelete} aria-label={`${title} 삭제`}>
            삭제
          </button>
        </div>
      </header>
      <p className="memo-line-clamp">{body || '본문 없이 제목만 저장됐어요.'}</p>
      <footer>
        <span>{dateLabel}</span>
        <div>{tags.slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}</div>
      </footer>
    </article>
  );
}

export function ScheduleTimelineItem({ item, timeLabel, meta, statusLabel, onToggle, onDelete, onOpen }) {
  const className = [
    'schedule-timeline-item',
    item.done ? 'schedule-completed-row done' : '',
    item.priority === '높음' ? 'urgent' : ''
  ].filter(Boolean).join(' ');

  return (
    <article className={className}>
      <time>{timeLabel}</time>
      <span className="schedule-time-rail" aria-hidden="true" />
      <div>
        <header>
          <strong>{item.title}</strong>
          <em>{statusLabel || (item.done ? '완료' : '예정')}</em>
        </header>
        <p>{meta}</p>
        <footer>
          <button type="button" onClick={() => onToggle(item)}>
            {item.done ? '대기로' : '완료'}
          </button>
          {onOpen ? (
            <button type="button" onClick={() => onOpen(item)}>
              수정
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" className="quiet" onClick={() => onDelete(item)}>
              삭제
            </button>
          ) : null}
        </footer>
      </div>
    </article>
  );
}

export function WorkoutSessionPanel({ done, badge, title, text }) {
  return (
    <section className={`workout-session-panel ${done ? 'done' : ''}`}>
      <span className="workout-status-badge">{badge}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

export function FinanceWalletCard({ balance, income, expense, usage, message }) {
  return (
    <section className="finance-wallet-card">
      <header>
        <span>월간 지갑</span>
        <strong>{balance}</strong>
        <small className="finance-amount-row">수입 {income} · 지출 {expense}</small>
      </header>
      <div className="lifeHubWalletMeter finance-budget-bar" role="progressbar" aria-label="월 지출 기준 사용률" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(100, usage)}>
        <div><span style={{ width: `${usage}%` }} /></div>
        <strong>{usage}%</strong>
      </div>
      <p>{message}</p>
    </section>
  );
}

export function TravelBoardingPass({ eyebrow, title, meta, badge, className = '', children }) {
  return (
    <section className={`travel-boarding-pass ${className}`.trim()}>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{meta}</p>
      </div>
      {badge ? <strong>{badge}</strong> : null}
      {children}
    </section>
  );
}

export function MoreSettingsRow({ icon, label, detail, onClick }) {
  return (
    <button type="button" className="more-settings-row" onClick={onClick}>
      <MemoNavIcon type={icon} />
      <span>{label}</span>
      {detail ? <small>{detail}</small> : null}
      <MemoNavIcon type="chevronRight" />
    </button>
  );
}
