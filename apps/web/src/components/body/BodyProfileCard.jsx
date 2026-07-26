import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  calculateBodyBmi,
  calculateWorkoutBmr
} from '../workout/workoutMetrics.js';

function metricText(value, unit = '') {
  return value ? `${Number(value).toLocaleString('ko-KR')}${unit}` : '미입력';
}

const BodyProfileCard = forwardRef(function BodyProfileCard({
  className = '',
  id,
  onChange,
  onSave,
  openRequest = 0,
  profile
}, detailsRef) {
  const bmi = calculateBodyBmi(profile);
  const bmr = calculateWorkoutBmr(profile);
  const [open, setOpen] = useState(() => !bmi || !bmr);
  const detailsElementRef = useRef(null);
  const setDetailsRef = useCallback((node) => {
    detailsElementRef.current = node;
    if (typeof detailsRef === 'function') detailsRef(node);
    else if (detailsRef) detailsRef.current = node;
  }, [detailsRef]);

  useEffect(() => {
    if (!bmi || !bmr) setOpen(true);
  }, [Boolean(bmi), Boolean(bmr)]);

  useEffect(() => {
    if (!openRequest) return undefined;
    setOpen(true);
    const frame = window.requestAnimationFrame(() => {
      detailsElementRef.current?.querySelector('input')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openRequest]);

  const update = (field, value) => onChange({ ...profile, [field]: value });
  const save = () => {
    const result = onSave(profile);
    if (result?.saved) setOpen(false);
  };

  return (
    <details
      ref={setDetailsRef}
      id={id}
      className={`lifeHubDetailsCard lifeHubBodyProfileCard ${className}`.trim()}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <small>운동·식단 공용</small>
          <strong>신체정보</strong>
        </span>
        <span>
          <strong>{bmi ? `BMI ${bmi.toFixed(1)}` : 'BMI 미입력'}</strong>
          <small>{bmr ? `BMR ${bmr.toLocaleString('ko-KR')}kcal` : 'BMR 미입력'}</small>
        </span>
      </summary>

      <div className="lifeHubBodyProfileMetrics" aria-label="공용 신체 지표" aria-live="polite">
        <article>
          <span>BMI</span>
          <output>{metricText(bmi?.toFixed(1))}</output>
        </article>
        <article>
          <span>기초대사량</span>
          <output>{metricText(bmr, 'kcal')}</output>
        </article>
      </div>

      <div className="lifeHubTwoCol lifeHubBodyProfileFields">
        <label>
          <span>몸무게 kg</span>
          <input type="number" inputMode="decimal" min="20" max="400" step="0.1" value={profile.weightKg} onChange={(event) => update('weightKg', event.target.value)} />
        </label>
        <label>
          <span>키 cm</span>
          <input type="number" inputMode="decimal" min="100" max="250" step="0.1" value={profile.heightCm} onChange={(event) => update('heightCm', event.target.value)} />
        </label>
        <label>
          <span>나이</span>
          <input type="number" inputMode="numeric" min="13" max="120" step="1" value={profile.age} onChange={(event) => update('age', event.target.value)} />
        </label>
        <label>
          <span>성별</span>
          <select value={profile.sex} onChange={(event) => update('sex', event.target.value)}>
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
        </label>
      </div>

      <p>정상 범위의 값은 현재 세션에 바로 공유되고 자동 저장됩니다. BMI는 몸무게와 키로 계산한 참고 지표예요.</p>
      <button type="button" onClick={save}>공용 신체정보 저장</button>
    </details>
  );
});

export default BodyProfileCard;
