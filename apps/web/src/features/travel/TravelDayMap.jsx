import { useMemo } from 'react';
import InteractiveTravelMap from './InteractiveTravelMap.jsx';
import { useEffect, useRef, useState } from 'react';
import { travelApi } from './travelApi.js';
import { validMapPoint } from './travelMapGeometry.js';
import { createTravelDayImage } from './travelDayImage.js';
import { exportTravelImage } from './travelImageExport.js';
const viewedDays = new Map();
export default function TravelDayMap({ day, title, destination = '' }) {
  const root = useRef(null), [visible, setVisible] = useState(false), [rows, setRows] = useState([]), [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(''), [saving, setSaving] = useState(false), [revision, setRevision] = useState(0);
  const alive = useRef(true), [searching, setSearching] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const points = useMemo(() => rows.map(row => row.candidates[row.selected] || null), [rows]);
  const key = JSON.stringify([destination, day.date, day.items.map(item => item.place)]);
  useEffect(() => { const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }); observer.observe(root.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false; setNotice('');
    const cached = viewedDays.get(key);
    if (cached && !revision) { setRows(cached); return; }
    setLoading(true);
    (async () => {
      const next = [];
      for (const item of day.items) {
        if (cancelled || document.visibilityState === 'hidden') break;
        const query = `${destination} ${item.place}`.trim().slice(0, 240);
        try {
          const value = await travelApi('map-search', { query });
          const candidates = (value.candidates || []).filter(validMapPoint);
          next.push({ query, candidates, selected: candidates.length ? 0 : -1 });
        } catch (error) { next.push({ query, candidates: [], selected: -1, error: error.message }); }
      }
      if (cancelled) return;
      while (next.length < day.items.length) next.push({ query: `${destination} ${day.items[next.length].place}`.trim().slice(0, 240), candidates: [], selected: -1, error: '화면을 다시 열고 위치를 검색해주세요.' });
      setRows(next); viewedDays.set(key, next); if (viewedDays.size > 100) viewedDays.delete(viewedDays.keys().next().value); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [visible, key, revision]);
  async function searchPlace(event, index) {
    event.preventDefault(); if (loading || searching) return;
    const query = String(new FormData(event.currentTarget).get('query') || '').trim();
    setSearching(true);
    try {
      const value = await travelApi('map-search', { query });
      if (!alive.current) return;
      const candidates = (value.candidates || []).filter(validMapPoint);
      setRows(previous => { const next = previous.map((row, i) => i === index ? { query, candidates, selected: candidates.length ? 0 : -1 } : row); viewedDays.set(key, next); return next; });
    } catch (error) { if (alive.current) setNotice(error.message); }
    finally { if (alive.current) setSearching(false); }
  }
  function choose(index, value) { const next = rows.map((row, i) => i === index ? { ...row, selected: Number(value) } : row); setRows(next); viewedDays.set(key, next); }
  return <section className="orbitTravelDayMap" ref={root} aria-label={`${day.day}일차 동선 지도`}>
    <div className="orbitTravelMapHeading"><strong>🗺️ 오늘의 동선</strong><button type="button" disabled={loading || !points.some(validMapPoint) || saving} onClick={async () => { setSaving(true); try { const result = await createTravelDayImage({ title, day, points, mapOnly: true }); setNotice(await exportTravelImage(result.dataUrl) ? '지도 이미지를 저장했어요.' : '저장을 취소했어요.'); } catch (error) { setNotice(error.message); } finally { setSaving(false); } }}>지도 저장</button></div>
    {visible ? <InteractiveTravelMap points={points} items={day.items} /> : null}
    {loading ? <p className="orbitTravelMapHint" role="status">방문할 장소를 찾고 있어요…</p> : !points.some(validMapPoint) ? <p className="orbitTravelMapHint">아래에서 장소를 검색하면 동선이 표시돼요.</p> : null}
    <p className="orbitTravelMapHint">번호는 방문 순서예요. 점선은 실제 도로 경로가 아니에요.</p>
    {notice ? <p className="orbitTravelMapHint" role="status">{notice}</p> : null}
    <details className="orbitTravelMapLocations"><summary>검색된 위치 확인 · 수정</summary>
      <p>이름이 같은 장소가 있을 수 있어요. 주소를 확인하고 맞는 위치를 선택해주세요.</p>
      {rows.map((row, index) => <form key={index} onSubmit={event => searchPlace(event, index)}><label><span>{index + 1}. {day.items[index].place}</span><select aria-label={`${index + 1}번 장소의 지도 위치`} value={row.selected} onChange={event => choose(index, event.target.value)}><option value={-1}>{row.candidates.length ? '지도에서 제외' : '위치를 찾지 못했어요'}</option>{row.candidates.map((point, i) => <option key={i} value={i}>{point.name} · {point.address}</option>)}</select>{row.error ? <small>{row.error}</small> : null}</label><div className="orbitTravelMapSearch"><input name="query" aria-label={`${index + 1}번 장소 검색어`} defaultValue={row.query} maxLength={240} required /><button type="submit" disabled={loading || searching}>찾기</button></div></form>)}
      <button type="button" disabled={loading || searching} onClick={() => setRevision(value => value + 1)}>위치 다시 찾기</button>
      <small>장소명은 Photon 지도 검색에 전달돼요. 지도·위치 © OpenStreetMap contributors (ODbL).</small>
    </details>
  </section>;
}
