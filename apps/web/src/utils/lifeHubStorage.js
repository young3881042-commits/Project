export function safeParse(raw, fallback) {
  try {
    if (raw === null || raw === undefined || raw === '') return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('LifeHub storage write failed', error);
    return false;
  }
}

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('LifeHub storage cleanup failed', error);
  }
}
