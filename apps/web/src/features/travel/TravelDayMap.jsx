import { useEffect, useRef, useState } from 'react';
import { travelApi } from './travelApi.js';
import { createTravelDayImage } from './travelDayImage.js';
import { ensureTravelDayImage } from './travelDayImageStore.js';
import { exportTravelImage } from './travelImageExport.js';
export default function TravelDayMap({ day, title, destination = '', owner = 'local' }) {
  const root = useRef(null), [visible, setVisible] = useState(false), [value, setValue] = useState(null);
  const [loading, setLoading] = useState(false), [notice, setNotice] = useState(''), [saving, setSaving] = useState(false), [revision, setRevision] = useState(0);
  const identity = JSON.stringify([owner, destination, title, day]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } });
    observer.observe(root.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController(); setLoading(true); setNotice('');
    ensureTravelDayImage({ owner, destination, title, day }, { force: revision > 0, signal: controller.signal,
      search: query => travelApi('map-search', { query }), render: createTravelDayImage })
      .then(image => { if (!controller.signal.aborted) { setValue(image); setNotice(image.storageError || ''); } })
      .catch(error => { if (!controller.signal.aborted) setNotice(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [visible, identity, revision]);
  return <section className="orbitTravelDailyImage" ref={root} aria-label={`${day.day}일차 일정 이미지`}>
    {value ? <img className="orbitTravelSavedDayImage" src={value.dataUrl} alt={`${day.day}일차 ${day.date}. ${day.title}. ${day.items.map((item, i) => `${i + 1}. ${item.time} ${item.title}, ${item.place}`).join(' / ')}. 지도 선은 방문 순서입니다.`} /> : null}
    {loading ? <p role="status">{day.day}일차 이미지 준비 중…</p> : null}
    {notice ? <p className="orbitTravelMapHint" role="status">{notice}</p> : null}
    <div className="orbitTravelImageActions"><button type="button" disabled={!value || saving} onClick={async () => { setSaving(true); try { setNotice(await exportTravelImage(value.dataUrl) ? '이미지 파일을 저장했어요.' : '저장을 취소했어요.'); } catch (error) { setNotice(error.message); } finally { setSaving(false); } }}>이미지 저장</button><button type="button" disabled={loading || saving} onClick={() => setRevision(n => n + 1)}>{value ? '다시 만들기' : '이미지 만들기'}</button></div>
  </section>;
}
