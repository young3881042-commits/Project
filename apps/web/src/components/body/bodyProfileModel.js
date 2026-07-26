import {
  BODY_PROFILE_LIMITS,
  DEFAULT_WORKOUT_PROFILE,
  calculateBodyBmi,
  calculateWorkoutBmr,
  normalizeWorkoutProfile
} from '../workout/workoutMetrics.js';
import { safeParse, safeRemoveItem, safeSetItem } from '../../utils/lifeHubStorage.js';

export const BODY_PROFILE_STORAGE_KEY = 'ai-assistant-body-profile';
export const BODY_PROFILE_SESSION_KEY = 'ai-assistant-body-profile-session';
export const LEGACY_WORKOUT_PROFILE_KEY = 'ai-assistant-workout-profile';
export const BODY_PROFILE_EVENT = 'lifehub:body-profile-updated';

function storageUsername(session) {
  const username = typeof session === 'string' ? session : session?.username;
  return String(username || 'guestuser').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
}

function scopedKey(baseKey, session) {
  return `${baseKey}:${storageUsername(session)}`;
}

function legacyStorageAllowed(session) {
  return !session || session.isGuest || session.username === 'guestuser';
}

function activeSessionStorage() {
  try {
    return globalThis.sessionStorage || null;
  } catch (error) {
    return null;
  }
}

function readSessionItem(key) {
  try {
    return activeSessionStorage()?.getItem(key) ?? null;
  } catch (error) {
    return null;
  }
}

function setSessionItem(key, value) {
  try {
    activeSessionStorage()?.setItem(key, value);
    return Boolean(activeSessionStorage());
  } catch (error) {
    return false;
  }
}

function removeSessionItem(key) {
  try {
    activeSessionStorage()?.removeItem(key);
  } catch (error) {
    // A blocked session store should not prevent local app usage.
  }
}

function profileRecord(profile, updatedAt = null) {
  return {
    schemaVersion: 1,
    ...normalizeWorkoutProfile(profile),
    updatedAt: Number.isFinite(Date.parse(updatedAt || '')) ? updatedAt : new Date().toISOString()
  };
}

function profileTimestamp(profile) {
  const timestamp = Date.parse(profile?.updatedAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sameProfile(left, right) {
  return JSON.stringify(normalizeWorkoutProfile(left)) === JSON.stringify(normalizeWorkoutProfile(right));
}

export function bodyProfilesEqual(left, right) {
  return sameProfile(left, right);
}

function newestStoredProfile(durableProfile, legacyProfile) {
  if (!durableProfile) return legacyProfile;
  if (!legacyProfile) return durableProfile;
  const durableIsValid = validateBodyProfile(durableProfile).valid;
  const legacyIsValid = validateBodyProfile(legacyProfile).valid;
  if (durableIsValid !== legacyIsValid) return legacyIsValid ? legacyProfile : durableProfile;
  const durableTimestamp = profileTimestamp(durableProfile);
  const legacyTimestamp = profileTimestamp(legacyProfile);
  if (durableTimestamp && legacyTimestamp) {
    return legacyTimestamp > durableTimestamp ? legacyProfile : durableProfile;
  }
  // A timestamp-less legacy value that differs was written by an older screen.
  if (!legacyTimestamp && !sameProfile(durableProfile, legacyProfile)) return legacyProfile;
  return durableProfile;
}

function emitBodyProfileChanged(session, profile) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(BODY_PROFILE_EVENT, {
    detail: { owner: storageUsername(session), profile }
  }));
}

export function bodyProfileStorageKey(session) {
  return scopedKey(BODY_PROFILE_STORAGE_KEY, session);
}

export function bodyProfileSessionKey(session) {
  return scopedKey(BODY_PROFILE_SESSION_KEY, session);
}

export function legacyBodyProfileStorageKey(session) {
  return scopedKey(LEGACY_WORKOUT_PROFILE_KEY, session);
}

export function validateBodyProfile(profile) {
  const normalized = normalizeWorkoutProfile(profile);
  const weight = Number(normalized.weightKg);
  const height = Number(normalized.heightCm);
  const age = Number(normalized.age);
  const bmi = calculateBodyBmi(normalized);
  const bmr = calculateWorkoutBmr(normalized);
  const valid = Boolean(
    bmi
    && bmr
    && Number.isFinite(weight)
    && weight >= BODY_PROFILE_LIMITS.weightKg.min
    && weight <= BODY_PROFILE_LIMITS.weightKg.max
    && Number.isFinite(height)
    && height >= BODY_PROFILE_LIMITS.heightCm.min
    && height <= BODY_PROFILE_LIMITS.heightCm.max
    && Number.isFinite(age)
    && age >= BODY_PROFILE_LIMITS.age.min
    && age <= BODY_PROFILE_LIMITS.age.max
  );
  return {
    valid,
    profile: normalized,
    bmi: valid ? bmi : null,
    bmr: valid ? bmr : null,
    message: valid
      ? ''
      : '몸무게 20~400kg, 키 100~250cm, 나이 13~120세 범위로 입력해주세요.'
  };
}

export function readBodyProfile(session, { preferSession = true } = {}) {
  const sessionKey = bodyProfileSessionKey(session);
  const durableKey = bodyProfileStorageKey(session);
  const legacyKey = legacyBodyProfileStorageKey(session);
  const sessionProfile = safeParse(readSessionItem(sessionKey), null);
  const durableProfile = safeParse(localStorage.getItem(durableKey), null);
  const legacyProfile = safeParse(localStorage.getItem(legacyKey), null);
  const unscopedLegacyProfile = legacyStorageAllowed(session)
    ? safeParse(localStorage.getItem(LEGACY_WORKOUT_PROFILE_KEY), null)
    : null;
  const storedProfile = newestStoredProfile(durableProfile, legacyProfile || unscopedLegacyProfile);
  const sessionIsValid = sessionProfile ? validateBodyProfile(sessionProfile).valid : false;
  const storedIsValid = storedProfile ? validateBodyProfile(storedProfile).valid : false;
  const sessionIsNewest = profileTimestamp(sessionProfile) >= profileTimestamp(storedProfile);
  const useSession = Boolean(
    preferSession
    && sessionProfile
    && (
      !storedProfile
      || (sessionIsValid && (!storedIsValid || sessionIsNewest))
    )
  );
  const selectedProfile = useSession
    ? sessionProfile
    : storedProfile || sessionProfile || DEFAULT_WORKOUT_PROFILE;
  const profile = normalizeWorkoutProfile(selectedProfile);
  const selectedRecord = profileRecord(profile, selectedProfile?.updatedAt);

  if (storedProfile && (!durableProfile || storedProfile !== durableProfile)) {
    safeSetItem(durableKey, JSON.stringify(selectedRecord));
  }
  if (!useSession || !sessionProfile) {
    setSessionItem(sessionKey, JSON.stringify(selectedRecord));
  }
  return profile;
}

export function cacheBodyProfileSession(session, profile) {
  const normalized = normalizeWorkoutProfile(profile);
  const saved = setSessionItem(bodyProfileSessionKey(session), JSON.stringify(profileRecord(normalized)));
  return { profile: normalized, saved };
}

export function saveBodyProfile(session, profile, { emit = true } = {}) {
  const validation = validateBodyProfile(profile);
  if (!validation.valid) {
    return { ...validation, saved: false };
  }

  const record = profileRecord(validation.profile);
  const serialized = JSON.stringify(record);
  const saved = safeSetItem(bodyProfileStorageKey(session), serialized);
  if (!saved) return { ...validation, saved: false, message: '공용 신체정보를 저장하지 못했어요.' };

  setSessionItem(bodyProfileSessionKey(session), serialized);
  // Keep the old key mirrored while legacy screens still exist in the bundle.
  safeSetItem(legacyBodyProfileStorageKey(session), serialized);
  if (legacyStorageAllowed(session)) safeRemoveItem(LEGACY_WORKOUT_PROFILE_KEY);
  if (emit) emitBodyProfileChanged(session, validation.profile);
  return { ...validation, saved: true };
}

export function clearBodyProfileSession(session) {
  removeSessionItem(bodyProfileSessionKey(session));
}
