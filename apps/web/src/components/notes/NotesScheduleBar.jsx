import MemoNavIcon from '../MemoNavIcon.jsx';

export default function NotesScheduleBar({ schedule, onScheduleChange, onDelete, onShare }) {
  return (
    <section className={`notesScheduleBar ${schedule.enabled ? 'enabled' : ''}`} aria-label="일정 연결">
      <label className="notesScheduleToggle">
        <input
          type="checkbox"
          checked={schedule.enabled}
          onChange={(event) => onScheduleChange({ enabled: event.target.checked })}
        />
        <span>일정 연결</span>
      </label>
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
