import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BODY_PROFILE_STORAGE_KEY,
  LEGACY_WORKOUT_PROFILE_KEY,
  bodyProfileSessionKey,
  bodyProfileStorageKey,
  cacheBodyProfileSession,
  clearBodyProfileSession,
  readBodyProfile,
  saveBodyProfile,
  validateBodyProfile
} from '../src/components/body/bodyProfileModel.js';
import {
  calculateBodyBmi,
  calculateWorkoutBmr,
  estimateWorkoutCalories
} from '../src/components/workout/workoutMetrics.js';

class MemoryStorage {
  #items = new Map();

  clear() {
    this.#items.clear();
  }

  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }

  removeItem(key) {
    this.#items.delete(key);
  }

  setItem(key, value) {
    this.#items.set(key, String(value));
  }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
globalThis.window = { dispatchEvent() {} };

const validProfile = {
  weightKg: '70',
  heightCm: '175',
  age: '30',
  sex: 'male'
};

test('공용 신체정보에서 BMI와 BMR을 파생 계산한다', () => {
  assert.equal(calculateBodyBmi(validProfile), 22.9);
  assert.equal(calculateWorkoutBmr(validProfile), 1649);

  const validation = validateBodyProfile(validProfile);
  assert.equal(validation.valid, true);
  assert.equal(validation.bmi, 22.9);
  assert.equal(validation.bmr, 1649);
  assert.equal(validateBodyProfile({ ...validProfile, heightCm: '' }).valid, false);
  assert.equal(validateBodyProfile({ ...validProfile, weightKg: '401' }).valid, false);
  assert.equal(calculateBodyBmi({ ...validProfile, weightKg: '-70' }), null);
  assert.equal(calculateWorkoutBmr({ ...validProfile, age: '-30' }), null);
  assert.equal(
    estimateWorkoutCalories({ templateId: 'cardio', durationMinutes: 60, profile: { ...validProfile, weightKg: '4000' } }),
    estimateWorkoutCalories({ templateId: 'cardio', durationMinutes: 60, profile: {} })
  );
});

test('입력 중 공용 프로필은 세션에 즉시 공유되고 정상값은 영구 저장된다', () => {
  localStorage.clear();
  sessionStorage.clear();
  const session = { username: 'shared-owner', isGuest: false };

  const draft = cacheBodyProfileSession(session, { ...validProfile, weightKg: '71' });
  assert.equal(draft.saved, true);
  assert.equal(readBodyProfile(session).weightKg, '71');
  assert.equal(localStorage.getItem(bodyProfileStorageKey(session)), null);

  const saved = saveBodyProfile(session, validProfile);
  assert.equal(saved.saved, true);
  assert.equal(saved.bmi, 22.9);
  assert.ok(localStorage.getItem(bodyProfileStorageKey(session)));

  cacheBodyProfileSession(session, { ...validProfile, weightKg: '72' });
  assert.equal(readBodyProfile(session).weightKg, '72');
  assert.equal(readBodyProfile(session, { preferSession: false }).weightKg, '70');

  clearBodyProfileSession(session);
  assert.equal(sessionStorage.getItem(bodyProfileSessionKey(session)), null);
  assert.equal(readBodyProfile(session).weightKg, '70');
});

test('잘못된 수정은 마지막 정상 영구 프로필을 덮어쓰지 않는다', () => {
  localStorage.clear();
  sessionStorage.clear();
  const session = { username: 'safe-owner', isGuest: false };
  assert.equal(saveBodyProfile(session, validProfile).saved, true);
  const before = localStorage.getItem(bodyProfileStorageKey(session));

  const invalid = saveBodyProfile(session, { ...validProfile, age: '' });
  assert.equal(invalid.saved, false);
  assert.equal(localStorage.getItem(bodyProfileStorageKey(session)), before);

  cacheBodyProfileSession(session, { ...validProfile, heightCm: '' });
  assert.deepEqual(readBodyProfile(session), validProfile);

  localStorage.setItem(`${LEGACY_WORKOUT_PROFILE_KEY}:safe-owner`, JSON.stringify({
    ...validProfile,
    weightKg: '4000'
  }));
  clearBodyProfileSession(session);
  assert.deepEqual(readBodyProfile(session), validProfile);
});

test('기존 운동 프로필을 공용 키로 이관하고 소유자별로 분리한다', () => {
  localStorage.clear();
  sessionStorage.clear();
  const firstSession = { username: 'first-owner', isGuest: false };
  const secondSession = { username: 'second-owner', isGuest: false };
  localStorage.setItem(`${LEGACY_WORKOUT_PROFILE_KEY}:first-owner`, JSON.stringify(validProfile));

  assert.deepEqual(readBodyProfile(firstSession), validProfile);
  assert.ok(localStorage.getItem(`${BODY_PROFILE_STORAGE_KEY}:first-owner`));
  assert.equal(readBodyProfile(secondSession).weightKg, '');
  assert.equal(readBodyProfile(secondSession).heightCm, '');
});

test('최신 영구값과 구 화면의 변경을 timestamp와 값 차이로 복구한다', () => {
  localStorage.clear();
  sessionStorage.clear();
  const session = { username: 'migration-owner', isGuest: false };
  assert.equal(saveBodyProfile(session, validProfile).saved, true);

  cacheBodyProfileSession(session, { ...validProfile, weightKg: '72' });
  localStorage.setItem(bodyProfileStorageKey(session), JSON.stringify({
    schemaVersion: 1,
    ...validProfile,
    weightKg: '73',
    updatedAt: '2999-01-01T00:00:00.000Z'
  }));
  assert.equal(readBodyProfile(session).weightKg, '73');

  localStorage.setItem(`${LEGACY_WORKOUT_PROFILE_KEY}:migration-owner`, JSON.stringify({
    ...validProfile,
    weightKg: '74'
  }));
  clearBodyProfileSession(session);
  assert.equal(readBodyProfile(session).weightKg, '74');
  assert.equal(JSON.parse(localStorage.getItem(bodyProfileStorageKey(session))).weightKg, '74');
});
