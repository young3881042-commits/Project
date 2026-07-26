export const FOOD_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const FOOD_PHOTO_MAX_DIMENSION = 1280;
export const FOOD_PHOTO_MAX_DATA_URL_BYTES = Math.floor(1.5 * 1024 * 1024);
export const FOOD_PHOTO_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const FOOD_PORTION_OPTIONS = Object.freeze([
  Object.freeze({ value: 0.5, label: '반만' }),
  Object.freeze({ value: 0.75, label: '조금 덜' }),
  Object.freeze({ value: 1, label: '사진만큼' }),
  Object.freeze({ value: 1.25, label: '조금 더' })
]);

const ALLOWED_TYPES = new Set(FOOD_PHOTO_ACCEPT.split(','));
const JPEG_QUALITIES = [0.88, 0.8, 0.72, 0.64, 0.56, 0.48, 0.42];

export class FoodPhotoAnalysisError extends Error {
  constructor(message, code = 'FOOD_PHOTO_ERROR') {
    super(message);
    this.name = 'FoodPhotoAnalysisError';
    this.code = code;
  }
}

function fail(message, code) {
  throw new FoodPhotoAnalysisError(message, code);
}

function rounded(value, digits = 1) {
  const unit = 10 ** digits;
  return Math.round(value * unit) / unit;
}

export function validateFoodPhotoFile(file) {
  if (!file) fail('분석할 음식 사진을 선택해주세요.', 'FILE_REQUIRED');
  const type = String(file.type || '').trim().toLowerCase();
  if (!ALLOWED_TYPES.has(type)) {
    fail('JPEG, PNG, WebP 음식 사진만 선택할 수 있어요.', 'UNSUPPORTED_FILE_TYPE');
  }
  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) {
    fail('비어 있거나 읽을 수 없는 사진이에요. 다른 사진을 선택해주세요.', 'EMPTY_FILE');
  }
  if (size > FOOD_PHOTO_MAX_SOURCE_BYTES) {
    fail('사진 원본은 20MB 이하여야 해요. 더 작은 사진을 선택해주세요.', 'SOURCE_TOO_LARGE');
  }
  return { type, size };
}

export function fitFoodPhotoDimensions(width, height, maxDimension = FOOD_PHOTO_MAX_DIMENSION) {
  const sourceWidth = Number(width);
  const sourceHeight = Number(height);
  const limit = Number(maxDimension);
  if (
    !Number.isFinite(sourceWidth)
    || !Number.isFinite(sourceHeight)
    || !Number.isFinite(limit)
    || sourceWidth <= 0
    || sourceHeight <= 0
    || limit <= 0
  ) {
    fail('사진 크기를 확인하지 못했어요. 다른 사진을 선택해주세요.', 'INVALID_DIMENSIONS');
  }
  const scale = Math.min(1, limit / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale))
  };
}

export function foodPhotoDataUrlByteLength(dataUrl) {
  const value = String(dataUrl || '');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]*={0,2}$/.test(value)) return 0;
  // A data URL is ASCII, so its string length is also its UTF-8 transport size.
  return value.length;
}

async function loadFoodPhoto(file) {
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      const bitmap = await globalThis.createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close?.()
      };
    } catch {
      try {
        const bitmap = await globalThis.createImageBitmap(file);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => bitmap.close?.()
        };
      } catch {
        // Older WebViews can fall back to an object URL and HTMLImageElement.
      }
    }
  }

  if (
    typeof globalThis.Image !== 'function'
    || typeof globalThis.URL?.createObjectURL !== 'function'
    || typeof globalThis.URL?.revokeObjectURL !== 'function'
  ) {
    fail('이 브라우저에서는 사진을 축소할 수 없어요.', 'IMAGE_DECODE_UNSUPPORTED');
  }
  const objectUrl = globalThis.URL.createObjectURL(file);
  const image = new globalThis.Image();
  image.decoding = 'async';
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('image_decode_failed'));
      image.src = objectUrl;
    });
  } catch {
    globalThis.URL.revokeObjectURL(objectUrl);
    fail('사진을 읽지 못했어요. 다른 사진을 선택해주세요.', 'IMAGE_DECODE_FAILED');
  }
  return {
    source: image,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    cleanup: () => globalThis.URL.revokeObjectURL(objectUrl)
  };
}

function drawFoodPhoto(source, width, height) {
  if (typeof globalThis.document?.createElement !== 'function') {
    fail('이 브라우저에서는 사진을 변환할 수 없어요.', 'CANVAS_UNSUPPORTED');
  }
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) fail('사진 변환 기능을 사용할 수 없어요.', 'CANVAS_UNSUPPORTED');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

function encodeCanvas(canvas, maxBytes) {
  for (const quality of JPEG_QUALITIES) {
    const imageDataUrl = canvas.toDataURL('image/jpeg', quality);
    const bytes = foodPhotoDataUrlByteLength(imageDataUrl);
    if (bytes > 0 && bytes <= maxBytes) {
      return { imageDataUrl, bytes, quality };
    }
  }
  return null;
}

export async function prepareFoodPhotoForAnalysis(file, {
  maxDimension = FOOD_PHOTO_MAX_DIMENSION,
  maxBytes = FOOD_PHOTO_MAX_DATA_URL_BYTES
} = {}) {
  validateFoodPhotoFile(file);
  const byteLimit = Number(maxBytes);
  if (!Number.isFinite(byteLimit) || byteLimit <= 0) {
    fail('사진 변환 용량 설정이 올바르지 않아요.', 'INVALID_BYTE_LIMIT');
  }

  let decoded;
  try {
    decoded = await loadFoodPhoto(file);
    let dimensions = fitFoodPhotoDimensions(decoded.width, decoded.height, maxDimension);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const canvas = drawFoodPhoto(decoded.source, dimensions.width, dimensions.height);
      const encoded = encodeCanvas(canvas, byteLimit);
      if (encoded) {
        return {
          ...encoded,
          width: dimensions.width,
          height: dimensions.height
        };
      }
      dimensions = {
        width: Math.max(1, Math.round(dimensions.width * 0.82)),
        height: Math.max(1, Math.round(dimensions.height * 0.82))
      };
    }
    fail('사진을 분석 가능한 크기로 줄이지 못했어요. 더 단순한 사진을 선택해주세요.', 'ENCODE_TOO_LARGE');
  } catch (error) {
    if (error instanceof FoodPhotoAnalysisError) throw error;
    fail('사진을 처리하지 못했어요. 다른 사진을 선택해주세요.', 'IMAGE_PROCESSING_FAILED');
  } finally {
    decoded?.cleanup?.();
  }
}

function requiredNumber(payload, key, label, { min = 0, max = 10000 } = {}) {
  const value = payload[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(`AI가 반환한 ${label} 값이 올바르지 않아요. 사진을 다시 분석해주세요.`, 'INVALID_ANALYSIS_RESPONSE');
  }
  return value;
}

export function normalizeFoodPhotoAnalysis(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('AI 분석 응답 형식이 올바르지 않아요. 다시 시도해주세요.', 'INVALID_ANALYSIS_RESPONSE');
  }
  const foodName = typeof payload.foodName === 'string' ? payload.foodName.trim() : '';
  if (!foodName || foodName.length > 80) {
    fail('AI가 음식 이름을 올바르게 반환하지 않았어요. 사진을 다시 분석해주세요.', 'INVALID_ANALYSIS_RESPONSE');
  }
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
  if (typeof payload.notes !== 'string' || notes.length > 300) {
    fail('AI가 분석 설명을 올바르게 반환하지 않았어요. 다시 시도해주세요.', 'INVALID_ANALYSIS_RESPONSE');
  }
  const caloriesKcal = requiredNumber(payload, 'caloriesKcal', '칼로리', { min: 1, max: 10000 });
  const carbohydratesGrams = requiredNumber(payload, 'carbohydratesGrams', '탄수화물', { max: 2000 });
  const proteinGrams = requiredNumber(payload, 'proteinGrams', '단백질', { max: 2000 });
  const fatGrams = requiredNumber(payload, 'fatGrams', '지방', { max: 2000 });
  const confidence = requiredNumber(payload, 'confidence', '신뢰도', { max: 1 });

  return {
    foodName,
    caloriesKcal: Math.round(caloriesKcal),
    carbohydratesGrams: rounded(carbohydratesGrams),
    proteinGrams: rounded(proteinGrams),
    fatGrams: rounded(fatGrams),
    confidence: rounded(confidence, 2),
    notes
  };
}

export function adjustFoodPhotoAnalysisPortion(originalAnalysis, multiplier = 1) {
  if (!originalAnalysis) return null;
  const requestedMultiplier = Number(multiplier);
  const portionMultiplier = FOOD_PORTION_OPTIONS.some(({ value }) => value === requestedMultiplier)
    ? requestedMultiplier
    : 1;
  const originalNotes = String(originalAnalysis.notes || '');
  const portionNote = portionMultiplier === 1
    ? originalNotes
    : [originalNotes, `양 보정 ${Math.round(portionMultiplier * 100)}%`].filter(Boolean).join(' · ');
  return {
    ...originalAnalysis,
    caloriesKcal: Math.max(1, Math.round(originalAnalysis.caloriesKcal * portionMultiplier)),
    carbohydratesGrams: rounded(originalAnalysis.carbohydratesGrams * portionMultiplier),
    proteinGrams: rounded(originalAnalysis.proteinGrams * portionMultiplier),
    fatGrams: rounded(originalAnalysis.fatGrams * portionMultiplier),
    notes: portionNote
  };
}

function containsKorean(value) {
  return /[\u3131-\u318e\uac00-\ud7a3]/.test(String(value || ''));
}

export function foodPhotoErrorMessage(error) {
  if (error instanceof FoodPhotoAnalysisError) return error.message;
  if (error?.code === 'OFFLINE') return '네트워크가 끊겨 사진을 분석할 수 없어요.';
  if (error?.code === 'TOKEN_MISSING' || error?.status === 401) return 'PC 연결이 만료되었어요. 다시 페어링해주세요.';
  if (error?.status === 403) return '이 기기에는 음식 사진 분석 권한이 없어요.';
  if (error?.status === 413 || error?.code === 'BODY_TOO_LARGE') return '분석용 사진 용량이 너무 커요. 다른 사진을 선택해주세요.';
  if (error?.status === 415) return 'JPEG, PNG, WebP 음식 사진만 분석할 수 있어요.';
  if (error?.status === 429) return 'AI 사용량이 잠시 제한됐어요. 잠시 후 다시 시도해주세요.';
  if (error?.code === 'TIMEOUT') return '음식 사진 분석 시간이 초과됐어요. 다시 시도해주세요.';
  if (error?.code === 'CODEX_LOGIN_REQUIRED') {
    return 'PC의 Codex 로그인이 만료됐어요. 서버에서 다시 로그인해주세요.';
  }
  if (error?.code === 'CODEX_UNAVAILABLE') {
    return 'PC의 Codex를 실행할 수 없어요. 서버 상태를 확인해주세요.';
  }
  if (containsKorean(error?.message)) return String(error.message);
  return '음식 사진을 분석하지 못했어요. 잠시 후 다시 시도해주세요.';
}
