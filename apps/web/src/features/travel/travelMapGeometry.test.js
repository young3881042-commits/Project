import test from 'node:test';
import assert from 'node:assert/strict';
import { dayMapLayout, validMapPoint } from './travelMapGeometry.js';
import { duplicateTravelStops } from './travelDuplicateStops.js';
test('map fits valid locations, keeps original visit numbers and handles date line', () => {
  assert.equal(validMapPoint({lat: NaN,lon:0}),false);
  assert.deepEqual(dayMapLayout([null]).tiles, []);
  for (const points of [[{lat:37.5797,lon:126.9766},null,{lat:37.551,lon:126.988}], [{lat:0,lon:179.99},{lat:0,lon:-179.99}]]) {
    const layout=dayMapLayout(points);
    assert.ok(layout.tiles.length <= 20);
    assert.ok(layout.points.every(p=>p.x>=40&&p.x<=600&&p.y>=40&&p.y<=360));
    assert.ok(layout.tiles.every(t=>/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(t.url)));
  }
  assert.deepEqual(dayMapLayout([{lat:1,lon:1},null,{lat:2,lon:2}]).points.map(p=>p.index),[0,2]);
});
test('repeated venues across days are detected without removing hotel returns or regional labels', () => {
  const plan={days:[{items:[{title:'궁궐 산책',place:'경복궁'},{title:'체크인',place:'서울 호텔'},{title:'산책',place:'서울'}]},{items:[{title:'사진 촬영',place:'경 복 궁'},{title:'숙소 복귀',place:'서울 호텔'},{title:'점심',place:'서울'}]}]};
  assert.deepEqual(duplicateTravelStops(plan),['경 복 궁']);
});
