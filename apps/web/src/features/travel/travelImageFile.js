export function hasTravelImageFiles(target = globalThis.window) { return Boolean(target?.AiAssistantNative?.requestTravelImageFile); }
export function travelImageFile(action, key, content = '', target = window, metadata = {}) {
  if (!['read', 'save'].includes(action) || !/^[a-f0-9]{64}$/.test(key)) return Promise.reject(new Error('이미지 경로를 확인해주세요.'));
  return new Promise((resolve, reject) => {
    const id = target.crypto.randomUUID();
    const cleanup = () => { clearTimeout(timer); target.removeEventListener('orbit:travel-image-file', receive); };
    const receive = event => {
      if (event.detail?.requestId !== id) return;
      cleanup();
      if (event.detail.error) { reject(new Error(event.detail.error)); return; }
      const data = event.detail;
      if (data.exists && !new RegExp(`^https://appassets\\.androidplatform\\.net/orbit-workspace/travel/${key}\\.png\\?v=[a-f0-9]{64}$`).test(data.url || '')) { reject(new Error('저장된 이미지 경로를 확인해주세요.')); return; }
      resolve(data.exists ? { dataUrl: data.url, path: data.path } : null);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('이미지 파일 응답이 늦어요. 다시 시도해주세요.')); }, 20000);
    target.addEventListener('orbit:travel-image-file', receive);
    try { target.AiAssistantNative.requestTravelImageFile(id, action, key, content, JSON.stringify(metadata)); } catch { cleanup(); reject(new Error('이미지 저장은 최신 앱에서 사용할 수 있어요.')); }
  });
}
