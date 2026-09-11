import { MAX_IMAGE_BYTES, MAX_PHOTO_BYTES, validateChatImage } from './chatImageRules.js';
export async function readChatImage(file) {
  if (file.size < 1 || file.size > MAX_PHOTO_BYTES) throw new Error('사진은 10MB까지 첨부할 수 있어요.');
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength !== file.size) throw new Error('사진을 끝까지 읽지 못했어요.');
  let bitmap;
  try { bitmap = await createImageBitmap(new Blob([bytes])); } catch { throw new Error('사진을 읽지 못했어요. JPG·PNG·WebP 사진을 선택해주세요.'); }
  try {
    const canvas = document.createElement('canvas'), ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('사진을 준비하지 못했어요.');
    let width = Math.max(1, Math.round(bitmap.width * ratio)), height = Math.max(1, Math.round(bitmap.height * ratio));
    for (let attempt = 0; attempt < 12; attempt++) {
      canvas.width = width; canvas.height = height;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); ctx.drawImage(bitmap, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', .82);
      if (dataUrl.length <= Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 23) return validateChatImage({ name: file.name, size: file.size, kind: 'image', dataUrl });
      width = Math.max(1, Math.floor(width * .8)); height = Math.max(1, Math.floor(height * .8));
    }
    throw new Error('사진 용량을 줄이지 못했어요. 더 작은 사진으로 보내주세요.');
  } finally { bitmap.close(); }
}
