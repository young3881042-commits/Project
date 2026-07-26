import { buildDailyMemo } from '../../components/notes/daily/dailyMemoModel.js';
import { normalizeDietEntry } from '../../components/diet/dietModel.js';
import {
  cardioActivityForId,
  createCardioExercise,
  estimateWorkoutCalories
} from '../../components/workout/workoutMetrics.js';

const LIFE_RECORD_KINDS = new Set(['memo', 'expense', 'income', 'workout', 'diet']);

function findDuplicate(items, origin) {
  return (Array.isArray(items) ? items : []).find((item) => (
    item?.origin?.kind === origin.kind
    && item.origin.requestId === origin.requestId
  ));
}

function identifierHash(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value || '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function savedResult(result, kind, item) {
  return result?.saved ? { status: 'created', kind, item } : { status: 'failed', kind };
}

export function saveLifeRecordAction(action, requestId, services = {}) {
  const kind = String(action?.kind || '');
  const fingerprint = String(action?.fingerprint || '').slice(0, 160);
  const normalizedRequestId = String(requestId || '').slice(0, 160);
  if (!LIFE_RECORD_KINDS.has(kind) || !fingerprint || !normalizedRequestId || !action?.draft) {
    return { status: 'failed', kind };
  }
  const origin = { kind: 'ai-life-record', requestId: normalizedRequestId, fingerprint };
  const now = typeof services.now === 'function' ? services.now() : new Date();
  const timestamp = now instanceof Date ? now.getTime() : Date.now();
  const createdAt = now instanceof Date && !Number.isNaN(now.getTime())
    ? now.toISOString()
    : new Date().toISOString();
  const idSuffix = `${fingerprint.slice(-8)}-${identifierHash(normalizedRequestId)}`;

  try {
    if (kind === 'memo') {
      const current = services.readNotes?.() || [];
      const duplicate = findDuplicate(current, origin);
      if (duplicate) return { status: 'duplicate', kind, item: duplicate };
      const item = {
        ...buildDailyMemo(action.draft),
        id: `note-ai-${timestamp}-${idSuffix}`,
        source: 'ai-chat',
        origin
      };
      return savedResult(services.saveNotes?.([item, ...current]), kind, item);
    }

    if (kind === 'expense' || kind === 'income') {
      const current = services.readBudget?.() || [];
      const duplicate = findDuplicate(current, origin);
      if (duplicate) return { status: 'duplicate', kind, item: duplicate };
      const item = services.normalizeBudget?.({
        ...action.draft,
        id: `budget-ai-${timestamp}-${idSuffix}`,
        source: 'ai-chat',
        origin,
        createdAt
      });
      if (!item) return { status: 'failed', kind };
      return savedResult(services.saveBudget?.([item, ...current]), kind, item);
    }

    if (kind === 'workout') {
      const current = services.readWorkouts?.() || [];
      const duplicate = findDuplicate(current, origin);
      if (duplicate) return { status: 'duplicate', kind, item: duplicate };
      const durationMinutes = Math.round(Number(action.draft.durationMinutes) || 0);
      const activity = action.draft.activityId ? cardioActivityForId(action.draft.activityId) : null;
      const exercises = activity
        ? [{ ...createCardioExercise(activity), durationMinutes: String(durationMinutes) }]
        : [{
            id: `exercise-ai-${timestamp}`,
            name: String(action.draft.activity || action.draft.title || '운동'),
            sets: '',
            reps: '',
            weight: '',
            durationMinutes: String(durationMinutes),
            met: ''
          }];
      const item = services.normalizeWorkout?.({
        ...action.draft,
        id: `workout-ai-${timestamp}-${idSuffix}`,
        caloriesBurned: estimateWorkoutCalories({
          templateId: action.draft.templateId,
          durationMinutes,
          exercises,
          profile: services.bodyProfile
        }) || 0,
        exercises,
        source: 'ai-chat',
        origin,
        createdAt
      });
      if (!item || !durationMinutes) return { status: 'failed', kind };
      return savedResult(services.saveWorkouts?.([item, ...current]), kind, item);
    }

    const current = services.readDietEntries?.() || [];
    const duplicate = findDuplicate(current, origin);
    if (duplicate) return { status: 'duplicate', kind, item: duplicate };
    const item = normalizeDietEntry({
      ...action.draft,
      id: `diet-ai-${timestamp}-${idSuffix}`,
      analysisSource: 'ai-chat',
      origin,
      createdAt
    });
    if (!item) return { status: 'failed', kind };
    return savedResult(services.saveDietEntries?.([item, ...current]), kind, item);
  } catch {
    return { status: 'failed', kind };
  }
}
