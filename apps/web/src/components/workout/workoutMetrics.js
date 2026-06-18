export const DEFAULT_WORKOUT_PROFILE = {
  weightKg: '',
  heightCm: '',
  age: '30',
  sex: 'male'
};

export const WORKOUT_CARDIO_ACTIVITIES = [
  { id: 'brisk-walk', name: '빠른 걷기', met: 4.3, durationMinutes: 30 },
  { id: 'jogging', name: '조깅', met: 7, durationMinutes: 25 },
  { id: 'running', name: '러닝', met: 9.8, durationMinutes: 20 },
  { id: 'cycling', name: '자전거', met: 6.8, durationMinutes: 30 },
  { id: 'elliptical', name: '일립티컬', met: 5, durationMinutes: 25 },
  { id: 'jump-rope', name: '줄넘기', met: 12.3, durationMinutes: 10 },
  { id: 'interval', name: '인터벌', met: 8, durationMinutes: 18 },
  { id: 'stretching', name: '스트레칭', met: 2.3, durationMinutes: 10 }
];

export const WORKOUT_TEMPLATES = [
  {
    id: 'upper',
    title: '상체',
    met: 3.8,
    items: ['푸시업', '덤벨 로우', '숄더 프레스'],
    exercises: [
      { name: '푸시업', sets: '3', reps: '12', weight: '' },
      { name: '덤벨 로우', sets: '3', reps: '10', weight: '' },
      { name: '숄더 프레스', sets: '3', reps: '10', weight: '' }
    ]
  },
  {
    id: 'lower',
    title: '하체',
    met: 4.8,
    items: ['스쿼트', '런지', '힙 브릿지'],
    exercises: [
      { name: '스쿼트', sets: '4', reps: '10', weight: '' },
      { name: '런지', sets: '3', reps: '12', weight: '' },
      { name: '힙 브릿지', sets: '3', reps: '15', weight: '' }
    ]
  },
  {
    id: 'cardio',
    title: '유산소',
    met: 6,
    items: ['빠른 걷기', '인터벌', '스트레칭'],
    exercises: WORKOUT_CARDIO_ACTIVITIES.slice(0, 3).map((activity) => ({
      mode: 'cardio',
      name: activity.name,
      durationMinutes: String(activity.durationMinutes),
      met: String(activity.met)
    }))
  }
];

export function parseWorkoutNumber(value) {
  const number = Number.parseFloat(String(value ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function cardioActivityForId(activityId) {
  return WORKOUT_CARDIO_ACTIVITIES.find((activity) => activity.id === activityId) || null;
}

export function cardioActivityForName(name) {
  const normalizedName = String(name || '').trim();
  return WORKOUT_CARDIO_ACTIVITIES.find((activity) => activity.name === normalizedName) || null;
}

export function cardioActivityIdForExercise(exercise) {
  return cardioActivityForName(exercise?.name)?.id || WORKOUT_CARDIO_ACTIVITIES[0].id;
}

export function createCardioExercise(activity = WORKOUT_CARDIO_ACTIVITIES[0]) {
  return {
    id: `exercise-${Date.now()}-${activity.id}`,
    mode: 'cardio',
    name: activity.name,
    sets: '',
    reps: '',
    weight: '',
    durationMinutes: String(activity.durationMinutes),
    met: String(activity.met)
  };
}

export function normalizeWorkoutProfile(profile = {}) {
  return {
    weightKg: String(profile.weightKg ?? '').trim(),
    heightCm: String(profile.heightCm ?? '').trim(),
    age: String(profile.age || DEFAULT_WORKOUT_PROFILE.age).trim(),
    sex: profile.sex === 'female' ? 'female' : 'male'
  };
}

export function calculateWorkoutBmr(profile) {
  const normalizedProfile = normalizeWorkoutProfile(profile);
  const weightKg = parseWorkoutNumber(normalizedProfile.weightKg);
  const heightCm = parseWorkoutNumber(normalizedProfile.heightCm);
  const age = parseWorkoutNumber(normalizedProfile.age);
  if (!weightKg || !heightCm || !age) return null;
  const sexOffset = normalizedProfile.sex === 'female' ? -161 : 5;
  return Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexOffset);
}

export function workoutDurationMinutes({ templateId, durationMinutes, exercises } = {}) {
  if (templateId === 'cardio') {
    return Math.round((exercises || []).reduce((total, exercise) => (
      total + parseWorkoutNumber(exercise?.durationMinutes || exercise?.reps)
    ), 0));
  }
  return Math.round(parseWorkoutNumber(durationMinutes));
}

export function workoutExerciseCalories(exercise, profile) {
  const weightKg = parseWorkoutNumber(profile?.weightKg);
  const minutes = parseWorkoutNumber(exercise?.durationMinutes || exercise?.reps);
  const met = parseWorkoutNumber(exercise?.met) || cardioActivityForName(exercise?.name)?.met || 0;
  if (!weightKg || !minutes || !met) return null;
  return Math.round((met * 3.5 * weightKg * minutes) / 200);
}

export function estimateWorkoutCalories({ templateId, durationMinutes, exercises, profile } = {}) {
  const weightKg = parseWorkoutNumber(profile?.weightKg);
  if (!weightKg) return null;
  if (templateId === 'cardio') {
    const total = (exercises || []).reduce((sum, exercise) => sum + (workoutExerciseCalories(exercise, profile) || 0), 0);
    return total > 0 ? Math.round(total) : null;
  }
  const template = WORKOUT_TEMPLATES.find((item) => item.id === templateId) || WORKOUT_TEMPLATES[0];
  const minutes = parseWorkoutNumber(durationMinutes);
  if (!minutes) return null;
  return Math.round((template.met * 3.5 * weightKg * minutes) / 200);
}
