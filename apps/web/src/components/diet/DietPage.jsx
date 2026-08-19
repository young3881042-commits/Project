import { useMemo, useRef, useState } from 'react';
import BodyProfileCard from '../body/BodyProfileCard.jsx';
import { FeedbackToast, useLifeHubFeedback } from '../lifehub/LifeHubUi.jsx';
import { calculateWorkoutBmr } from '../workout/workoutMetrics.js';
import DietEnergySummaryCard from './DietEnergySummaryCard.jsx';
import DietEntryForm from './DietEntryForm.jsx';
import DietEntryList from './DietEntryList.jsx';
import {
  createDietDraft,
  updateDietDraftField
} from './dietDraft.js';
import {
  calculateDailyEnergySummary,
  normalizeDietEntry,
  readDietEntries,
  saveDietEntries
} from './dietModel.js';

function scrollBehavior() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export default function DietPage({
  model,
  onBodyProfileChange,
  onSaveBodyProfile,
  refresh,
  session
}) {
  const [draft, setDraft] = useState(() => createDietDraft());
  const [profileOpenRequest, setProfileOpenRequest] = useState(0);
  const calorieInputRef = useRef(null);
  const profileCardRef = useRef(null);
  const profile = model.bodyProfile;
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const bmr = calculateWorkoutBmr(profile);

  const todayEntries = useMemo(
    () => model.dietEntries.filter((entry) => entry.date === model.today),
    [model.dietEntries, model.today]
  );
  const summary = useMemo(() => calculateDailyEnergySummary({
    bmr,
    date: model.today,
    dietEntries: model.dietEntries,
    workouts: model.workouts
  }), [bmr, model.dietEntries, model.today, model.workouts]);
  const resetAfterSave = () => {
    setDraft(createDietDraft());
    refresh();
  };

  const saveDraft = (
    candidate,
    successMessage = '먹은 칼로리를 기록했어요.',
  ) => {
    const entry = normalizeDietEntry({
      id: 'diet-' + Date.now(),
      date: model.today,
      mealType: candidate.mealType,
      food: candidate.food,
      calories: candidate.calories,
      carbohydratesGrams: candidate.carbohydratesGrams,
      proteinGrams: candidate.proteinGrams,
      fatGrams: candidate.fatGrams,
      confidence: candidate.confidence,
      notes: candidate.notes,
      analysisSource: candidate.analysisSource,
      createdAt: new Date().toISOString()
    });
    if (!entry) {
      notify('먹은 칼로리를 1~10,000 사이로 입력해주세요.', 'error');
      return false;
    }

    const result = saveDietEntries(session, [entry, ...readDietEntries(session)]);
    if (result.saved) resetAfterSave();
    notify(
      result.saved ? successMessage : '식단 기록을 저장하지 못했어요.',
      result.saved ? 'success' : 'error'
    );
    return result.saved;
  };

  const submitEntry = (event) => {
    event.preventDefault();
    saveDraft(draft);
  };

  const focusEntryForm = () => {
    window.requestAnimationFrame(() => {
      calorieInputRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
      calorieInputRef.current?.focus({ preventScroll: true });
    });
  };

  const deleteEntry = (entry) => {
    if (!window.confirm('이 식단 기록을 삭제할까요?')) return;
    const result = saveDietEntries(
      session,
      readDietEntries(session).filter((item) => item.id !== entry.id)
    );
    if (result.saved) refresh();
    notify(
      result.saved ? '식단 기록을 삭제했어요.' : '식단 기록을 삭제하지 못했어요.',
      result.saved ? 'success' : 'error'
    );
  };

  const saveProfile = () => {
    const result = onSaveBodyProfile(profile);
    notify(
      result.saved ? `공용 신체정보를 저장했어요. BMI ${result.bmi.toFixed(1)}` : result.message,
      result.saved ? 'success' : 'error'
    );
    return result;
  };

  const openProfile = () => {
    setProfileOpenRequest((current) => current + 1);
    window.requestAnimationFrame(() => {
      profileCardRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    });
  };

  const changeDraftField = (field, value) => {
    setDraft((current) => updateDietDraftField(current, field, value));
  };

  return (
    <div className="lifeHubPage lifeHubDietPage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />

      <DietEnergySummaryCard
        bmr={bmr}
        summary={summary}
        hasEntries={todayEntries.length > 0}
        onOpenProfile={openProfile}
      />

      <DietEntryForm
        ref={calorieInputRef}
        draft={draft}
        onChangeField={changeDraftField}
        onSubmit={submitEntry}
      />

      <BodyProfileCard
        ref={profileCardRef}
        id="shared-body-profile-diet"
        className="lifeHubDietProfile"
        profile={profile}
        onChange={onBodyProfileChange}
        onSave={saveProfile}
        openRequest={profileOpenRequest}
      />

      <DietEntryList
        entries={todayEntries}
        intakeCalories={summary.intakeCalories}
        onDelete={deleteEntry}
        onStartEntry={focusEntryForm}
      />
    </div>
  );
}
