export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 160 * 1024;
export const isPhotoName = name => /\.(jpe?g|png|webp)$/i.test(name || '');
export function validateChatImage(value) {
  if (value.kind !== 'image' || !isPhotoName(value.name) || !Number.isInteger(value.size) || value.size < 1 || value.size > MAX_PHOTO_BYTES || typeof value.dataUrl !== 'string' || value.dataUrl.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 23 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.dataUrl)) throw new Error('사진 형식이나 크기를 확인해주세요.');
  let bytes; try { bytes = Uint8Array.from(atob(value.dataUrl.slice(23)), c => c.charCodeAt(0)); } catch { throw new Error('사진을 읽지 못했어요.'); }
  if (bytes.length > MAX_IMAGE_BYTES || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new Error('올바른 JPEG 사진이 아니에요.');
  let dimensions;
  for (let offset = 2; offset + 8 < bytes.length;) {
    if (bytes[offset++] !== 255) break;
    const marker = bytes[offset++];
    if (marker === 218 || marker === 217) break;
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if ([192,193,194].includes(marker)) { dimensions = { height: bytes[offset + 3] * 256 + bytes[offset + 4], width: bytes[offset + 5] * 256 + bytes[offset + 6] }; break; }
    offset += length;
  }
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 1600 || dimensions.height > 1600) throw new Error('사진 해상도를 확인해주세요.');
  return { name: value.name, size: value.size, kind: 'image', dataUrl: value.dataUrl, ...dimensions, text: '[사진 첨부]', truncated: false };
}
