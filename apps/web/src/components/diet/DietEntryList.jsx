import MemoNavIcon from '../MemoNavIcon.jsx';
import { EmptyState } from '../lifehub/LifeHubUi.jsx';
import { mealTypeLabel } from './dietModel.js';
import { hasNutrition, mealEmoji, nutritionGrams } from './dietPresentation.js';

export default function DietEntryList({ entries, intakeCalories, onDelete, onStartEntry }) {
  return (
    <section className="lifeHubDietLog" aria-labelledby="lifeHubDietLogTitle">
      <header>
        <div>
          <span>오늘 {entries.length}건</span>
          <h2 id="lifeHubDietLogTitle">먹은 기록</h2>
        </div>
        <strong>{intakeCalories.toLocaleString('ko-KR')}kcal</strong>
      </header>
      {entries.length ? (
        <div>
          {entries.map((entry) => {
            const mealLabel = mealTypeLabel(entry.mealType);
            const entryLabel = entry.food || mealLabel + ' 기록';

            return (
              <article key={entry.id}>
                <span className="lifeHubDietMealEmoji" aria-hidden="true">{mealEmoji(entry.mealType)}</span>
                <div>
                  <span>{mealLabel}</span>
                  <strong>{entryLabel}</strong>
                  {hasNutrition(entry) ? (
                    <small className="lifeHubDietLogMacros">
                      탄 {nutritionGrams(entry.carbohydratesGrams)} · 단 {nutritionGrams(entry.proteinGrams)} · 지 {nutritionGrams(entry.fatGrams)}
                    </small>
                  ) : null}
                </div>
                <em>{entry.calories.toLocaleString('ko-KR')}kcal</em>
                <button
                  type="button"
                  className="lifeHubDietDeleteButton"
                  onClick={() => onDelete(entry)}
                  aria-label={entryLabel + ' 식단 삭제'}
                >
                  <MemoNavIcon type="trash" />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="오늘 먹은 기록이 없어요"
          text="칼로리부터 가볍게 적으면 오늘 합계를 계산해드릴게요."
          actionLabel="첫 식단 기록"
          icon="meal"
          onAction={onStartEntry}
        />
      )}
    </section>
  );
}
