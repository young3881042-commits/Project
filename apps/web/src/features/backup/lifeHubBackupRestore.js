import {
  LIFEHUB_BACKUP_COLLECTIONS,
  planLifeHubBackupImport
} from './lifeHubBackupCodec.js';

const COLLECTION_LABELS = Object.freeze({
  schedules: '일정',
  notes: '메모',
  workouts: '운동',
  dietEntries: '식단',
  budgetEntries: '가계부',
  recurringPayments: '정기 결제',
  trips: '여행'
});
const RESTORE_KEYS = Object.freeze([
  ...LIFEHUB_BACKUP_COLLECTIONS,
  'bodyProfile',
  'dailyBriefingSettings'
]);

function normalizeCollection(items, normalize, key) {
  const label = COLLECTION_LABELS[key] || key;
  if (!Array.isArray(items) || typeof normalize !== 'function') {
    throw new Error(`${label} 백업 데이터가 올바르지 않아요.`);
  }
  const normalized = items.map((item, index) => normalize(item, index)).filter(Boolean);
  if (normalized.length !== items.length) {
    throw new Error(`${label} 항목 중 이 앱에서 사용할 수 없는 기록이 있어요.`);
  }
  const ids = new Set(normalized.map((item) => String(item?.id || '')));
  if (ids.has('') || ids.size !== normalized.length) {
    throw new Error(`${label} 항목의 ID가 비어 있거나 중복됐어요.`);
  }
  return normalized;
}

export function prepareLifeHubRestoreData(plan, {
  fallbackBodyProfile,
  fallbackDailyBriefingSettings,
  normalizers,
  validateBodyProfile
}) {
  const data = plan?.data;
  if (!data || typeof data !== 'object') throw new Error('복원 계획에 데이터가 없어요.');
  if (!normalizers
      || typeof normalizers.dailyBriefingSettings !== 'function'
      || typeof validateBodyProfile !== 'function') {
    throw new Error('복원 검증기를 준비하지 못했어요.');
  }
  const profileValidation = validateBodyProfile(data.bodyProfile ?? fallbackBodyProfile);
  if (!profileValidation?.valid) {
    throw new Error(`신체정보를 복원할 수 없어요. ${profileValidation?.message || ''}`.trim());
  }
  const restored = Object.fromEntries(LIFEHUB_BACKUP_COLLECTIONS.map((key) => [
    key,
    normalizeCollection(data[key], normalizers[key], key)
  ]));
  restored.bodyProfile = profileValidation.profile;
  const briefingSettings = normalizers.dailyBriefingSettings(
    data.dailyBriefingSettings ?? fallbackDailyBriefingSettings
  );
  if (!briefingSettings || typeof briefingSettings !== 'object' || Array.isArray(briefingSettings)) {
    throw new Error('자동 브리핑 설정을 복원할 수 없어요.');
  }
  restored.dailyBriefingSettings = briefingSettings;
  return restored;
}

function writeData(data, writers, { continueOnFailure = false } = {}) {
  let allSaved = true;
  for (const key of RESTORE_KEYS) {
    const write = writers?.[key];
    let saved = false;
    try {
      saved = typeof write === 'function' && write(data[key])?.saved === true;
    } catch {
      saved = false;
    }
    allSaved = allSaved && saved;
    if (!saved && !continueOnFailure) break;
  }
  return allSaved;
}

function hasAllWriters(writers) {
  return RESTORE_KEYS.every((key) => typeof writers?.[key] === 'function');
}

function notify(callback, value) {
  try {
    callback?.(value);
  } catch {
    // Storage is already committed or rolled back; UI notification must not change that result.
  }
}

export function applyLifeHubBackupPlan(plan, {
  readCurrent,
  normalizers,
  validateBodyProfile,
  writers,
  onProfile,
  onRefresh
}) {
  if (typeof readCurrent !== 'function') {
    return { saved: false, message: '현재 데이터를 읽지 못했어요. 기존 데이터는 그대로 유지했어요.' };
  }
  let previous;
  try {
    previous = readCurrent();
  } catch {
    return { saved: false, message: '현재 데이터를 읽지 못했어요. 기존 데이터는 그대로 유지했어요.' };
  }
  let writesStarted = false;
  try {
    const hasBackupSnapshot = plan
      && Object.prototype.hasOwnProperty.call(plan, 'backupSnapshot');
    const effectivePlan = hasBackupSnapshot
      ? planLifeHubBackupImport(previous, plan.backupSnapshot, { mode: plan.mode })
      : plan;
    const next = prepareLifeHubRestoreData(effectivePlan, {
      fallbackBodyProfile: previous.bodyProfile,
      fallbackDailyBriefingSettings: previous.dailyBriefingSettings,
      normalizers,
      validateBodyProfile
    });
    if (!hasAllWriters(writers)) {
      throw new Error('복원 저장소를 준비하지 못했어요.');
    }
    writesStarted = true;
    if (!writeData(next, writers)) {
      throw new Error('저장공간이 부족하거나 브라우저 저장소를 사용할 수 없어요.');
    }
    notify(onProfile, next.bodyProfile);
    notify(onRefresh);
    return { saved: true, data: next, plan: effectivePlan };
  } catch (error) {
    const rolledBack = !writesStarted || writeData(previous, writers, { continueOnFailure: true });
    if (writesStarted) notify(onRefresh);
    return {
      saved: false,
      rolledBack,
      message: rolledBack
        ? `${error?.message || '복원할 수 없어요.'} 기존 데이터는 그대로 유지했어요.`
        : '복원과 자동 되돌리기에 실패했어요. 앱을 닫지 말고 방금 만든 백업 파일을 보관해주세요.'
    };
  }
}
