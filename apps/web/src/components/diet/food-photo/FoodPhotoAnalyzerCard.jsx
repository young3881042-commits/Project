import { useId, useRef } from 'react';
import MemoNavIcon from '../../MemoNavIcon.jsx';
import { LifeHubButton } from '../../lifehub/LifeHubUi.jsx';
import { FOOD_PHOTO_ACCEPT, FOOD_PORTION_OPTIONS } from '../foodPhotoAnalysis.js';
import { bodyProfileBasis, confidenceLabel, nutritionGrams } from '../dietPresentation.js';

export default function FoodPhotoAnalyzerCard({
  adjustedAnalysis,
  bridgeStatus,
  isAnalyzing,
  mealLabel,
  message,
  onConnect,
  onEdit,
  onOpenProfile,
  onPortionChange,
  onRecord,
  onReset,
  onRetry,
  onSelectFile,
  photoCaloriePercent,
  portionMultiplier,
  previewUrl,
  profile,
  referenceCalories,
  selectedFileName,
  status
}) {
  const fileInputRef = useRef(null);
  const titleId = useId();
  const portionHelpId = useId();
  const connected = bridgeStatus.kind === 'connected';
  const step = adjustedAnalysis ? 3 : previewUrl ? 2 : 1;

  const selectPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onSelectFile(file);
  };

  return (
    <section
      className="lifeHubDietPhoto"
      aria-labelledby={titleId}
    >
      <input
        ref={fileInputRef}
        className="lifeHubDietPhotoInput"
        type="file"
        accept={FOOD_PHOTO_ACCEPT}
        disabled={!connected || isAnalyzing}
        onChange={selectPhoto}
        aria-label="분석할 음식 사진 선택"
      />

      <header className="lifeHubDietPhotoHeader">
        <div>
          <span>AI 영양 도우미</span>
          <h2 id={titleId}>사진 한 장이면 톡톡 계산해요</h2>
        </div>
        <span className={`lifeHubDietBridgeStatus ${bridgeStatus.kind}`} role="status">
          <i aria-hidden="true" />
          {bridgeStatus.label}
        </span>
      </header>
      <p className="lifeHubDietPhotoIntro">사진에 보이는 양을 기준으로 칼로리와 영양을 차분하게 추정해드려요.</p>

      <ol className="lifeHubDietPhotoSteps" aria-label="사진 식단 기록 단계">
        {['사진 고르기', '분석하기', '기록하기'].map((label, index) => {
          const number = index + 1;
          return (
            <li key={label} className={step >= number ? 'active' : ''} aria-current={step === number ? 'step' : undefined}>
              <span>{number}</span>{label}
            </li>
          );
        })}
      </ol>

      <p className="lifeHubDietLiveStatus" role="status" aria-live="polite">
        {isAnalyzing ? '음식 사진을 분석하고 있어요.' : status === 'ready' ? message : ''}
      </p>
      <div
        className={`lifeHubDietPhotoPicker ${previewUrl ? 'hasPreview' : ''}`}
        aria-busy={isAnalyzing}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={adjustedAnalysis ? `${adjustedAnalysis.foodName}으로 분석한 음식 사진` : '선택한 음식 사진 미리보기'} />
        ) : (
          <div className="lifeHubDietPhotoEmpty" aria-hidden="true">
            <span><MemoNavIcon type="camera" /></span>
            <i>✦</i>
          </div>
        )}
        {!previewUrl ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!connected || isAnalyzing}
          >
            <MemoNavIcon type="camera" />
            <span>사진 고르기</span>
          </button>
        ) : !isAnalyzing ? (
          <div className="lifeHubDietPhotoPickerActions">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!connected}>
              <MemoNavIcon type="refresh" />
              <span>바꾸기</span>
            </button>
            <button type="button" className="quiet" onClick={onReset} aria-label="선택한 사진 지우기">
              <MemoNavIcon type="close" />
            </button>
          </div>
        ) : null}
        {isAnalyzing ? (
          <div className="lifeHubDietPhotoOverlay">
            <i aria-hidden="true" />
            <strong>한입 한입 살펴보는 중…</strong>
            <small>잠시만 기다려주세요</small>
            <button type="button" onClick={onReset}>분석 취소</button>
          </div>
        ) : null}
      </div>

      {!connected ? (
        <div className="lifeHubDietPhotoConnect">
          <p role="status">Orbit 서버를 연결하면 사진 분석을 시작할 수 있어요.</p>
          <button type="button" className="lifeHubDietProfileLink" onClick={onConnect}>Orbit 서버 연결하기</button>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="lifeHubDietPhotoError" role="alert">
          <p>{message}</p>
          <div>
            {selectedFileName ? <button type="button" onClick={onRetry} disabled={!connected}>다시 분석</button> : null}
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!connected}>다른 사진</button>
          </div>
        </div>
      ) : null}

      {adjustedAnalysis ? (
        <article className="lifeHubDietPhotoResult">
          <header className="lifeHubDietPhotoResultHeader">
            <div>
              <span>사진 속 양 추정</span>
              <h3>{adjustedAnalysis.foodName}</h3>
            </div>
            <strong>{adjustedAnalysis.caloriesKcal.toLocaleString('ko-KR')}<small>kcal</small></strong>
          </header>

          <div className="lifeHubDietMacroGrid" aria-label="추정 탄수화물 단백질 지방">
            <div><span>탄수화물</span><strong>{nutritionGrams(adjustedAnalysis.carbohydratesGrams)}</strong></div>
            <div><span>단백질</span><strong>{nutritionGrams(adjustedAnalysis.proteinGrams)}</strong></div>
            <div><span>지방</span><strong>{nutritionGrams(adjustedAnalysis.fatGrams)}</strong></div>
          </div>

          <fieldset className="lifeHubDietPortionPicker" aria-describedby={portionHelpId}>
            <legend>실제로 먹은 양은 어느 정도인가요?</legend>
            <div>
              {FOOD_PORTION_OPTIONS.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="food-photo-portion"
                    value={option.value}
                    checked={portionMultiplier === option.value}
                    onChange={() => onPortionChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <small id={portionHelpId}>고른 양에 맞춰 칼로리와 영양값을 함께 바꿔요.</small>
          </fieldset>

          {photoCaloriePercent !== null ? (
            <div className="lifeHubDietPhotoCalorieShare">
              <header>
                <span>BMR + 오늘 운동 참고 기준 {referenceCalories.toLocaleString('ko-KR')}kcal 중</span>
                <strong>{photoCaloriePercent}%</strong>
              </header>
              <progress
                max="100"
                value={Math.min(photoCaloriePercent, 100)}
                aria-label={`분석 음식은 BMR과 오늘 운동 참고 기준의 ${photoCaloriePercent}%`}
              />
              <small>{bodyProfileBasis(profile)} · 추천 섭취 목표가 아닌 단순 비교예요.</small>
            </div>
          ) : (
            <button type="button" className="lifeHubDietCalorieProfilePrompt" onClick={onOpenProfile}>
              신체정보를 저장하면 BMR + 운동 비교도 보여드려요
            </button>
          )}

          <p className="lifeHubDietPhotoNotes">{adjustedAnalysis.notes || '사진에 보이는 양을 기준으로 계산한 참고값이에요.'}</p>
          <p className="lifeHubDietConfidence">
            <span>AI 참고 신뢰도 {confidenceLabel(adjustedAnalysis.confidence)}</span>
            실제 재료와 조리법에 따라 달라질 수 있어요.
          </p>
          <div className="lifeHubDietPhotoResultActions">
            <LifeHubButton type="button" className="primary" icon="plus" onClick={() => onRecord(adjustedAnalysis)}>
              {mealLabel}으로 바로 기록
            </LifeHubButton>
            <button type="button" className="lifeHubDietPhotoEditButton" onClick={() => onEdit(adjustedAnalysis)}>
              입력칸에서 수정
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
