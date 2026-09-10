import { dayMapLayout } from './travelMapGeometry.js';
function loadTile(url, signal) {
  return new Promise(resolve => {
    const image = new Image(); image.crossOrigin = 'anonymous'; image.referrerPolicy = 'origin';
    let done = false;
    const finish = value => { if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); image.onload = image.onerror = null; resolve(value); };
    const abort = () => { finish(null); image.src = ''; };
    const timer = setTimeout(abort, 7000);
    image.onload = () => finish(image); image.onerror = () => finish(null);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort(); else image.src = url;
  });
}
function line(ctx, value, x, y, width, font = '24px sans-serif', color = '#24493d') {
  ctx.font = font; ctx.fillStyle = color;
  let text = String(value || '');
  if (ctx.measureText(text).width > width) { while (text && ctx.measureText(text + '…').width > width) text = text.slice(0, -1); text += '…'; }
  ctx.fillText(text, x, y);
}
export async function createTravelDayImage({ title, day, points, signal }) {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 720 + day.items.length * 100;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('이미지를 만들지 못했어요.');
  ctx.fillStyle = '#f7f6ef'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  line(ctx, `ORBIT  /  ${day.day}일차 · ${day.date}`, 40, 49, 640, 'bold 20px sans-serif', '#53786a');
  line(ctx, title, 40, 96, 640, 'bold 32px sans-serif'); line(ctx, day.title, 40, 133, 640, '22px sans-serif');
  const layout = dayMapLayout(points), images = await Promise.all(layout.tiles.map(tile => loadTile(tile.url, signal)));
  if (signal?.aborted) throw new Error('이미지 만들기를 취소했어요.');
  ctx.save(); ctx.beginPath(); ctx.rect(40, 165, 640, 400); ctx.clip(); ctx.translate(40, 165);
  ctx.fillStyle = '#e4eee5'; ctx.fillRect(0, 0, 640, 400);
  images.forEach((image, index) => { if (image) ctx.drawImage(image, layout.tiles[index].x, layout.tiles[index].y, 256, 256); });
  let previous;
  for (const point of layout.points) {
    if (previous && point.index === previous.index + 1) {
      ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(point.x, point.y); ctx.strokeStyle = '#16765c'; ctx.lineWidth = 5; ctx.setLineDash([10, 7]); ctx.stroke(); ctx.setLineDash([]);
      const angle = Math.atan2(point.y - previous.y, point.x - previous.x), x = (point.x + previous.x) / 2, y = (point.y + previous.y) / 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fillStyle = '#16765c'; ctx.fill(); ctx.restore();
    }
    previous = point;
  }
  for (const point of layout.points) { ctx.beginPath(); ctx.arc(point.x, point.y, 17, 0, Math.PI * 2); ctx.fillStyle = '#135b49'; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke(); ctx.textAlign = 'center'; line(ctx, point.index + 1, point.x, point.y + 7, 35, 'bold 20px sans-serif', 'white'); ctx.textAlign = 'left'; }
  if (!layout.points.length) line(ctx, '위치를 확인하면 지도와 동선이 표시돼요', 40, 190, 560, '24px sans-serif');
  ctx.restore();
  line(ctx, '© OpenStreetMap contributors · openstreetmap.org/copyright', 44, 588, 635, '17px sans-serif', '#53645a');
  const missingTiles = images.some(image => !image);
  line(ctx, `${layout.points.length}/${day.items.length}곳 표시 · 점선은 방문 순서예요 (실제 도로 경로 아님)`, 40, 620, 640, '19px sans-serif');
  line(ctx, missingTiles ? '지도 배경 일부를 불러오지 못했어요 · 검색 위치 확인 필요' : '검색된 위치 기준 · 출발 전 장소와 이동 시간을 확인하세요', 40, 649, 640, '18px sans-serif', '#6a716a');
  day.items.forEach((item, index) => {
    const y = 696 + index * 100;
    ctx.fillStyle = index % 2 ? '#f0f2ea' : '#fffef9'; ctx.fillRect(30, y - 26, 660, 94);
    line(ctx, `${index + 1}`, 44, y + 6, 35, 'bold 24px sans-serif'); line(ctx, item.time, 90, y + 6, 100, 'bold 24px sans-serif', '#16765c');
    line(ctx, item.title, 197, y + 6, 473, 'bold 24px sans-serif');
    line(ctx, `${item.place}${points[index] ? '' : ' · 지도 위치 미확인'}`, 90, y + 39, 580, '20px sans-serif', '#59675f');
  });
  return { dataUrl: canvas.toDataURL('image/png'), missingTiles };
}
