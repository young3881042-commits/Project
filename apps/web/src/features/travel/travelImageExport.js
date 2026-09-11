export async function exportTravelImage(dataUrl, target = window) {
  if (/^https:\/\/appassets\.androidplatform\.net\/orbit-workspace\/travel\/[a-f0-9]{64}\.png\?v=[a-f0-9]{64}$/.test(dataUrl)) {
    const response = await target.fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('저장된 이미지 파일을 읽지 못했어요.');
    const blob = await response.blob();
    if (blob.size > 4194304 || blob.type !== 'image/png') throw new Error('저장된 PNG를 확인해주세요.');
    dataUrl = await new Promise((resolve, reject) => { const reader = new target.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했어요.')); reader.readAsDataURL(blob); });
  }
  if (!/^data:image\/png;base64,/.test(dataUrl) || dataUrl.length > 5600000) return Promise.reject(new Error('저장할 이미지 크기를 확인해주세요.'));
  if (target.AiAssistantNative?.exportTravelImage) return new Promise((resolve, reject) => {
    const id = target.crypto.randomUUID();
    const cleanup = () => { clearTimeout(timer); target.removeEventListener('orbit:travel-image-export', receive); };
    const receive = event => { if (event.detail?.requestId !== id) return; cleanup(); if (event.detail.error) reject(new Error(event.detail.error)); else resolve(!event.detail.cancelled); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('이미지 저장을 다시 시도해주세요.')); }, 300000);
    target.addEventListener('orbit:travel-image-export', receive);
    try { target.AiAssistantNative.exportTravelImage(id, dataUrl.slice(dataUrl.indexOf(',') + 1)); } catch { cleanup(); reject(new Error('앱 업데이트 후 다시 시도해주세요.')); }
  });
  if (target.AiAssistantNative) return Promise.reject(new Error('이미지 저장은 최신 앱에서 사용할 수 있어요.'));
  const link = target.document.createElement('a'); link.href = dataUrl; link.download = 'Orbit-여행일정.png'; target.document.body.appendChild(link); link.click(); link.remove(); return Promise.resolve(true);
}
