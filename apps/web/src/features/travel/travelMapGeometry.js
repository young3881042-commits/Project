export function validMapPoint(point) { return point && Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 85 && Math.abs(point.lon) <= 180; }
const project = point => { const sin = Math.sin(point.lat * Math.PI / 180); return [(point.lon + 180) / 360, .5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)]; };
export function dayMapLayout(points, width = 640, height = 400) {
  const valid = points.map((point, index) => validMapPoint(point) ? { index, xy: project(point) } : null).filter(Boolean);
  if (!valid.length) return { points: [], tiles: [] };
  const anchor = valid[0].xy[0];
  valid.forEach(row => { while (row.xy[0] - anchor > .5) row.xy[0]--; while (row.xy[0] - anchor < -.5) row.xy[0]++; });
  const xs = valid.map(row => row.xy[0]), ys = valid.map(row => row.xy[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((width - 110) / Math.max(maxX - minX, 1e-9), (height - 110) / Math.max(maxY - minY, 1e-9));
  const zoom = Math.max(1, Math.min(15, Math.floor(Math.log2(scale / 256)))), world = 256 * 2 ** zoom;
  const left = (minX + maxX) / 2 * world - width / 2, top = (minY + maxY) / 2 * world - height / 2;
  const tiles = [];
  for (let y = Math.floor(top / 256); y <= Math.floor((top + height) / 256); y++) for (let x = Math.floor(left / 256); x <= Math.floor((left + width) / 256); x++) {
    if (y >= 0 && y < 2 ** zoom) tiles.push({ url: `https://tile.openstreetmap.org/${zoom}/${((x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom}/${y}.png`, x: x * 256 - left, y: y * 256 - top });
  }
  return { points: valid.map(row => ({ index: row.index, x: row.xy[0] * world - left, y: row.xy[1] * world - top })), tiles, zoom };
}
