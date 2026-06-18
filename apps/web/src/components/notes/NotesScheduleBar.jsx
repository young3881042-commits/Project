import MemoNavIcon from '../MemoNavIcon.jsx';

export default function NotesScheduleBar({ schedule, onScheduleChange, onDelete, onShare }) {
  return (
    <section className={`notesScheduleBar ${schedule.enabled ? 'enabled' : ''}`} aria-label="일정 연결">
      <button
        type="button"
        className={`notesScheduleOnOffButton ${schedule.enabled ? 'active' : ''}`}
        onClick={() => onScheduleChange({ enabled: !schedule.enabled })}
        aria-pressed={schedule.enabled}
      >
        <MemoNavIcon type="calendar" />
        <span>스케줄</span>
        <strong>{schedule.enabled ? 'ON' : 'OFF'}</strong>
      </button>
      <label>
        <span>날짜</span>
        <input
          type="date"
          value={schedule.date}
          disabled={!schedule.enabled}
          onChange={(event) => onScheduleChange({ date: event.target.value })}
        />
      </label>
      <label>
        <span>시간</span>
        <input
          type="time"
          value={schedule.time}
          disabled={!schedule.enabled}
          onChange={(event) => onScheduleChange({ time: event.target.value })}
        />
      </label>
      <button type="button" className="notesShareButton" onClick={onShare}><MemoNavIcon type="link" />공유</button>
      <button type="button" className="notesDeleteButton" onClick={onDelete}><MemoNavIcon type="trash" />삭제</button>
    </section>
  );
}
