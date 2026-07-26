import { forwardRef } from 'react';
import MemoNavIcon from '../MemoNavIcon.jsx';
import { LifeHubButton, QuickChoiceGroup } from '../lifehub/LifeHubUi.jsx';
import { DIET_MEAL_TYPES } from './dietModel.js';
import { confidenceLabel, hasNutrition, nutritionGrams } from './dietPresentation.js';

const DietEntryForm = forwardRef(function DietEntryForm({
  draft,
  onChangeField,
  onClearAiNutrition,
  onSubmit
}, caloriesInputRef) {
  const hasAiAnalysis = Boolean(draft.analysisSource);
  const hasConfidence = draft.confidence !== null
    && draft.confidence !== undefined
    && Number.isFinite(Number(draft.confidence));

  return (
    <form className="lifeHubFormCard lifeHubDietForm" onSubmit={onSubmit}>
      <header>
        <div>
          <strong>먹은 칼로리 기록</strong>
          <small>{hasAiAnalysis ? 'AI 추정값을 확인한 뒤 저장해주세요.' : '칼로리만 입력해도 바로 합산돼요.'}</small>
        </div>
      </header>

      {hasAiAnalysis ? (
        <aside className="lifeHubDietAiDraft" aria-label="AI 사진 분석 입력값">
          <div>
            <span className="lifeHubDietAiPill"><MemoNavIcon type="spark" />AI 사진 분석</span>
            {hasConfidence ? <small>참고 신뢰도 {confidenceLabel(draft.confidence)}</small> : null}
          </div>
          {hasNutrition(draft) ? (
            <p>
              탄 {nutritionGrams(draft.carbohydratesGrams)} · 단 {nutritionGrams(draft.proteinGrams)} · 지 {nutritionGrams(draft.fatGrams)}
            </p>
          ) : null}
          {draft.notes ? <p className="lifeHubDietAiNotes">{draft.notes}</p> : null}
          <button type="button" className="lifeHubDietAiClear" onClick={onClearAiNutrition}>
            AI 영양정보 지우기
          </button>
        </aside>
      ) : null}

      <label className="lifeHubDietCaloriesField">
        <span>먹은 칼로리</span>
        <span>
          <input
            ref={caloriesInputRef}
            type="number"
            inputMode="numeric"
            min="1"
            max="10000"
            step="1"
            value={draft.calories}
            onChange={(event) => onChangeField('calories', event.target.value)}
            placeholder="예: 500"
            aria-label="먹은 칼로리"
          />
          <em>kcal</em>
        </span>
      </label>
      <QuickChoiceGroup
        label="언제 먹었나요?"
        options={DIET_MEAL_TYPES}
        value={draft.mealType}
        onChange={(mealType) => onChangeField('mealType', mealType)}
        className="lifeHubDietMealChoices"
      />
      <label>
        <span>먹은 음식 <small>선택</small></span>
        <input
          value={draft.food}
          onChange={(event) => onChangeField('food', event.target.value)}
          placeholder="예: 닭가슴살 샐러드"
          maxLength={80}
        />
      </label>
      <LifeHubButton type="submit" className="primary" icon="plus">식단 저장</LifeHubButton>
    </form>
  );
});

export default DietEntryForm;
