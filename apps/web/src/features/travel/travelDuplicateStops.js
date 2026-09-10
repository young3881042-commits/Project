const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
// Repeated bases and transfers are necessary; vague regional labels do not identify a venue.
export function travelStopKey(item) {
  if (/숙소|호텔|리조트|체크인|체크아웃|귀가|귀환|복귀|공항|터미널|기차역|자택|집으로/.test(`${item.title} ${item.place}`)) return '';
  const place = normalize(item.place);
  if (!place || /^(서울|부산|제주|제주도|인천|대구|대전|광주|울산|세종|미정|현지|근처|시내|이동|휴식|식당|카페|자유시간)$/.test(place) || /^(인근|근처|주변|미정)/.test(place)) return '';
  return place;
}
export function duplicateTravelStops(plan) {
  const seen = new Set(), duplicates = [];
  for (const day of plan.days) for (const item of day.items) {
    const key = travelStopKey(item);
    if (!key) continue;
    if (seen.has(key)) duplicates.push(item.place); else seen.add(key);
  }
  return [...new Set(duplicates)];
}
