import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { validMapPoint } from './travelMapGeometry.js';
export default function InteractiveTravelMap({ points, items }) {
  const root = useRef(null), map = useRef(null), layer = useRef(null), api = useRef(null), tiles = useRef(null);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let stopped = false, observer;
    import('leaflet').then(L => {
      if (stopped) return; api.current = L;
      map.current = L.map(root.current, { scrollWheelZoom: false, attributionControl: true }).setView([20, 0], 2);
      map.current.attributionControl.setPrefix(false);
      tiles.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: true, referrerPolicy: 'origin', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>', keepBuffer: 0, updateWhenIdle: true }).on('tileerror', () => setError('지도 배경을 불러오지 못했어요. 인터넷 연결을 확인해주세요.'));
      layer.current = L.layerGroup().addTo(map.current);
      observer = new ResizeObserver(() => map.current?.invalidateSize()); observer.observe(root.current); setReady(true);
    }).catch(() => setError('지도를 열지 못했어요. 화면을 다시 열어주세요.'));
    return () => { stopped = true; observer?.disconnect(); map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const L = api.current, bounds = []; layer.current.clearLayers(); let previous = null;
    points.forEach((point, index) => {
      if (!validMapPoint(point)) { previous = null; return; }
      const latlng = [point.lat, point.lon]; bounds.push(latlng);
      if (previous) L.polyline([previous, latlng], { color: '#17775d', weight: 4, dashArray: '8 7' }).addTo(layer.current);
      const popup = document.createElement('div'); popup.textContent = `${index + 1}. ${items[index].time} · ${items[index].place}`;
      L.marker(latlng, { title: `${index + 1}. ${items[index].place}`, icon: L.divIcon({ className: 'orbitTravelMapPin', html: `<span>${index + 1}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }) }).bindPopup(popup).addTo(layer.current);
      previous = latlng;
    });
    if (bounds.length) { tiles.current.addTo(map.current); map.current.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 }); } else if (tiles.current) map.current.removeLayer(tiles.current);
  }, [ready, points, items]);
  function fit() { const bounds = points.filter(validMapPoint).map(p => [p.lat, p.lon]); if (bounds.length) map.current?.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 }); }
  return <div className="orbitTravelInteractive"><div ref={root} className="orbitTravelMapCanvas" role="region" aria-label="확대하고 움직일 수 있는 날짜별 동선 지도" /><button type="button" className="orbitTravelFit" onClick={fit} disabled={!ready}>전체 동선</button>{error ? <p role="status">{error}</p> : null}<div className="orbitTravelMapStopChips">{items.map((item, index) => <button type="button" key={index} disabled={!validMapPoint(points[index])} onClick={() => map.current?.setView([points[index].lat, points[index].lon], 16)}>{index + 1}. {item.place}</button>)}</div></div>;
}
