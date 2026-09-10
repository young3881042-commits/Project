import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
export function mapQuery(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 240 || /[\x00-\x1f\x7f]|https?:\/\//i.test(value)) throw new Error('지도에서 찾을 장소명을 확인해주세요.');
  return value.trim().replace(/\s+/g, ' ');
}
export function mapCandidates(value) {
  return (Array.isArray(value?.features) ? value.features : []).slice(0, 5).flatMap(feature => {
    const [lon, lat] = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : [];
    const p = feature?.properties;
    if (!p || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180 || typeof p.name !== 'string') return [];
    return [{ lat, lon, name: p.name.slice(0, 160), address: [p.country, p.state, p.city, p.district, p.street, p.housenumber].filter(x => typeof x === 'string').join(' ').slice(0, 300) }];
  });
}
export function createMapSearch({ fetcher = fetch, directory = join(homedir(), '.cache/orbit-maps'), interval = 1100 } = {}) {
  let active = false, last = 0;
  const memory = new Map(), controller = new AbortController();
  return { get busy() { return active; }, close() { controller.abort(); }, async search(raw) {
    const query = mapQuery(raw), key = createHash('sha256').update(query).digest('hex');
    let cached = memory.get(key);
    if (!cached) try { cached = JSON.parse(await readFile(join(directory, key + '.json'), 'utf8')); } catch {}
    if (cached && Date.now() - cached.at < 7 * 86400000 && Array.isArray(cached.candidates)) return { candidates: cached.candidates, cached: true };
    if (active) throw Object.assign(new Error('다른 지도 검색이 끝난 뒤 다시 눌러주세요.'), { status: 429 });
    active = true;
    try {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, interval - (Date.now() - last))));
      controller.signal.throwIfAborted(); last = Date.now();
      const url = new URL('https://photon.komoot.io/api/'); url.searchParams.set('q', query); url.searchParams.set('limit', '5');
      const response = await fetcher(url, { headers: { 'User-Agent': 'Orbit/0.9.2 (+https://github.com/young3881042-commits/Project)' }, redirect: 'error', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6500)]) });
      if (!response.ok) throw new Error('지도 검색을 이용하지 못했어요. 잠시 후 다시 시도해주세요.');
      const reader = response.body.getReader(); let length = 0, chunks = [];
      try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 128000) throw new Error('지도 검색 응답이 너무 커요.'); chunks.push(value); } } finally { await reader.cancel(); }
      const candidates = mapCandidates(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      cached = { at: Date.now(), candidates }; memory.set(key, cached);
      if (memory.size > 500) memory.delete(memory.keys().next().value);
      try { await mkdir(directory, { recursive: true, mode: 0o700 }); await writeFile(join(directory, key + '.json'), JSON.stringify(cached), { mode: 0o600 }); } catch { /* In-memory cache still avoids repeat calls. */ }
      return { candidates, cached: false };
    } finally { active = false; }
  } };
}
