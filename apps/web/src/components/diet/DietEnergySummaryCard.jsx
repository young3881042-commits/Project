import MemoNavIcon from '../MemoNavIcon.jsx';
import { KCAL_PER_KG_ESTIMATE } from './dietModel.js';
import { deficitLabel, weightChangeLabel } from './dietPresentation.js';

export default function DietEnergySummaryCard({ bmr, summary, hasEntries, onOpenProfile }) {
  const estimateReady = Boolean(bmr && hasEntries);
  const resultLabel = !bmr
    ? 'BMR 필요'
    : !hasEntries
      ? '섭취 기록 필요'
      : deficitLabel(summary.energyDeficitCalories);
  const comparisonCalories = bmr
    ? summary.restingCalories + summary.workoutCalories
    : null;

  return (
    <section className="lifeHubDietBalance" aria-label="오늘 에너지 참고">
      <header>
        <div>
          <span>오늘 에너지 참고</span>
          <strong>{resultLabel}</strong>
        </div>
        <MemoNavIcon type="meal" />
      </header>
      <div className="lifeHubDietMetrics">
        <article>
          <span>기초대사량</span>
          <strong>{bmr ? bmr.toLocaleString('ko-KR') + 'kcal' : '미입력'}</strong>
        </article>
        <article>
          <span>운동 소모</span>
          <strong>{summary.workoutCalories.toLocaleString('ko-KR')}kcal</strong>
        </article>
        <article>
          <span>먹은 칼로리</span>
          <strong>{summary.intakeCalories.toLocaleString('ko-KR')}kcal</strong>
        </article>
      </div>
      <div className="lifeHubDietDeficit">
        <span>BMR + 운동 비교 기준</span>
        <strong>{comparisonCalories ? `${comparisonCalories.toLocaleString('ko-KR')}kcal` : '신체정보 필요'}</strong>
      </div>
      {!bmr ? (
        <button type="button" className="lifeHubDietProfileLink" onClick={onOpenProfile}>
          몸 정보 입력하기
        </button>
      ) : null}
      <details className="lifeHubDietBasis">
        <summary>계산 기준 보기</summary>
        <p>
          오늘 먹은 내용이 모두 기록됐다고 가정하고, BMR + 운동 소모 - 섭취 칼로리로
          에너지 차이를 계산해요.
        </p>
        <small>
          단순 체중 환산: {weightChangeLabel(summary, estimateReady)}. 에너지 차이 ÷{' '}
          {KCAL_PER_KG_ESTIMATE.toLocaleString('ko-KR')}kcal로 계산한 참고값이며 실제 체중은
          수분·소화·일상 활동에 따라 달라져요.
        </small>
      </details>
    </section>
  );
}
