import { useMemo, useRef, useState } from 'react';
import BodyProfileCard from '../body/BodyProfileCard.jsx';
import { FeedbackToast, useLifeHubFeedback } from '../lifehub/LifeHubUi.jsx';
import { calculateWorkoutBmr } from '../workout/workoutMetrics.js';
import useBridgeConnection from '../../features/lifehub-ai/useBridgeConnection.js';
import DietEnergySummaryCard from './DietEnergySummaryCard.jsx';
import DietEntryForm from './DietEntryForm.jsx';
import DietEntryList from './DietEntryList.jsx';
import {
  applyPhotoAnalysisToDraft,
  clearDietDraftNutrition,
  createDietDraft,
  shouldPreserveDraftAfterPhotoRecord,
  syncPhotoAnalysisDraft,
  updateDietDraftField
} from './dietDraft.js';
import {
  calculateCalorieTargetPercent,
  calculateDailyEnergySummary,
  mealTypeLabel,
  normalizeDietEntry,
  readDietEntries,
  saveDietEntries
} from './dietModel.js';
import { adjustFoodPhotoAnalysisPortion } from './foodPhotoAnalysis.js';
import FoodPhotoAnalyzerCard from './food-photo/FoodPhotoAnalyzerCard.jsx';
import useFoodPhotoAnalyzer from './food-photo/useFoodPhotoAnalyzer.js';

function scrollBehavior() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export default function DietPage({
  model,
  navigate,
  onBodyProfileChange,
  onSaveBodyProfile,
  refresh,
  session
}) {
  const [draft, setDraft] = useState(() => createDietDraft());
  const [profileOpenRequest, setProfileOpenRequest] = useState(0);
  const calorieInputRef = useRef(null);
  const profileCardRef = useRef(null);
  const draftedPhotoAnalysisRef = useRef(null);
  const { client: bridgeClient, status: bridgeStatus } = useBridgeConnection({ poll: true });
  const photo = useFoodPhotoAnalyzer({ bridgeClient, bridgeStatus });
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
  const referenceCalories = summary.restingCalories === null
    ? null
    : summary.restingCalories + summary.workoutCalories;
  const photoCaloriePercent = calculateCalorieTargetPercent(
    photo.adjustedAnalysis?.caloriesKcal,
    referenceCalories
  );

  const resetAfterSave = ({ preserveDraft = false } = {}) => {
    if (!preserveDraft) setDraft(createDietDraft());
    draftedPhotoAnalysisRef.current = null;
    photo.reset();
    refresh();
  };

  const saveDraft = (
    candidate,
    successMessage = '먹은 칼로리를 기록했어요.',
    options = {}
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
    if (result.saved) resetAfterSave(options);
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

  const recordPhotoAnalysis = (analysis) => {
    const photoDraft = applyPhotoAnalysisToDraft(
      { ...createDietDraft(), mealType: draft.mealType },
      analysis
    );
    const hasUnrelatedDraft = shouldPreserveDraftAfterPhotoRecord(
      draft,
      draftedPhotoAnalysisRef.current,
      photo.analysis
    );
    saveDraft(
      photoDraft,
      `${mealTypeLabel(photoDraft.mealType)} 식단으로 바로 기록했어요.`,
      { preserveDraft: hasUnrelatedDraft }
    );
  };

  const focusEntryForm = () => {
    window.requestAnimationFrame(() => {
      calorieInputRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
      calorieInputRef.current?.focus({ preventScroll: true });
    });
  };

  const editPhotoAnalysis = (analysis) => {
    if (!analysis) {
      setProfileOpenRequest((current) => current + 1);
      window.requestAnimationFrame(() => {
        profileCardRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      });
      return;
    }
    draftedPhotoAnalysisRef.current = photo.analysis;
    setDraft((current) => applyPhotoAnalysisToDraft(current, analysis));
    focusEntryForm();
    notify('분석값을 입력칸에 담았어요. 원하는 부분만 고쳐주세요.', 'success');
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

  const openProfile = () => editPhotoAnalysis(null);

  const selectPhotoFile = (file) => {
    draftedPhotoAnalysisRef.current = null;
    return photo.analyzeFile(file);
  };

  const resetPhoto = () => {
    draftedPhotoAnalysisRef.current = null;
    photo.reset();
  };

  const changePhotoPortion = (multiplier) => {
    photo.setPortionMultiplier(multiplier);
    if (!photo.analysis || draftedPhotoAnalysisRef.current !== photo.analysis) return;
    const adjusted = adjustFoodPhotoAnalysisPortion(photo.analysis, multiplier);
    setDraft((current) => syncPhotoAnalysisDraft(current, adjusted));
  };

  const changeDraftField = (field, value) => {
    if (field === 'food' || field === 'calories') draftedPhotoAnalysisRef.current = null;
    setDraft((current) => updateDietDraftField(current, field, value));
  };

  const clearDraftNutrition = () => {
    draftedPhotoAnalysisRef.current = null;
    setDraft((current) => clearDietDraftNutrition(current));
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

      <FoodPhotoAnalyzerCard
        adjustedAnalysis={photo.adjustedAnalysis}
        bridgeStatus={bridgeStatus}
        isAnalyzing={photo.isAnalyzing}
        mealLabel={mealTypeLabel(draft.mealType)}
        message={photo.message}
        onConnect={() => navigate('/ai/settings')}
        onEdit={editPhotoAnalysis}
        onOpenProfile={openProfile}
        onPortionChange={changePhotoPortion}
        onRecord={recordPhotoAnalysis}
        onReset={resetPhoto}
        onRetry={photo.retry}
        onSelectFile={selectPhotoFile}
        photoCaloriePercent={photoCaloriePercent}
        portionMultiplier={photo.portionMultiplier}
        previewUrl={photo.previewUrl}
        profile={profile}
        referenceCalories={referenceCalories}
        selectedFileName={photo.selectedFileName}
        status={photo.status}
      />

      <DietEntryForm
        ref={calorieInputRef}
        draft={draft}
        onChangeField={changeDraftField}
        onClearAiNutrition={clearDraftNutrition}
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
