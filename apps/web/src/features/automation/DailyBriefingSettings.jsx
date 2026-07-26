import { useEffect, useState } from 'react';
import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import {
  DAILY_BRIEFING_EVENT,
  readDailyBriefingSettings,
  saveDailyBriefingSettings
} from './dailyBriefing.js';

export default function DailyBriefingSettings({
  session,
  notificationStatus = 'default',
  onRequestNotifications,
  onSaved
}) {
  const [settings, setSettings] = useState(() => readDailyBriefingSettings(session));
  const [message, setMessage] = useState('');
  const [permission, setPermission] = useState(notificationStatus);

  useEffect(() => {
    const sync = () => setSettings(readDailyBriefingSettings(session));
    window.addEventListener(DAILY_BRIEFING_EVENT, sync);
    return () => window.removeEventListener(DAILY_BRIEFING_EVENT, sync);
  }, [session?.username]);

  useEffect(() => {
    setPermission(notificationStatus);
  }, [notificationStatus]);

  const update = (patch) => {
    const next = { ...settings, ...patch };
    const result = saveDailyBriefingSettings(session, next);
    setSettings(result.settings);
    setMessage(result.saved ? '브리핑 시간을 저장했어요.' : '브리핑 설정을 저장하지 못했어요.');
    if (result.saved) onSaved?.(result.settings);
  };

  const requestNotifications = async () => {
    const result = await onRequestNotifications?.();
    setPermission(result || 'unsupported');
    setMessage(result === 'granted'
      ? '알림을 켰어요. 설정한 시각에 브리핑을 알려드릴게요.'
      : result === 'denied'
        ? '휴대폰 설정에서 Orbit 알림을 허용해주세요.'
        : '이 환경에서는 백그라운드 브리핑 알림을 사용할 수 없어요.');
    if (result === 'granted') onSaved?.(settings);
  };

  return (
    <section className="lifeHubBriefingSettings" aria-labelledby="dailyBriefingSettingsTitle">
      <header>
        <span><MemoNavIcon type="bell" /></span>
        <div>
          <h3 id="dailyBriefingSettingsTitle">아침·저녁 자동 브리핑</h3>
          <p>정해둔 시간에 오늘 일정과 생활 기록을 알려드려요.</p>
        </div>
      </header>
      <div className="lifeHubBriefingSettingRows">
        <div className="lifeHubBriefingSettingRow">
          <input id="lifehub-morning-briefing-toggle" type="checkbox" checked={settings.morningEnabled} onChange={(event) => update({ morningEnabled: event.target.checked })} />
          <label htmlFor="lifehub-morning-briefing-toggle"><strong>아침 브리핑</strong><small>오늘 일정과 놓친 일</small></label>
          <input type="time" value={settings.morningTime} disabled={!settings.morningEnabled} aria-label="아침 브리핑 시각" onChange={(event) => update({ morningTime: event.target.value })} />
        </div>
        <div className="lifeHubBriefingSettingRow">
          <input id="lifehub-evening-briefing-toggle" type="checkbox" checked={settings.eveningEnabled} onChange={(event) => update({ eveningEnabled: event.target.checked })} />
          <label htmlFor="lifehub-evening-briefing-toggle"><strong>저녁 브리핑</strong><small>일정·운동·식단·지출 정리</small></label>
          <input type="time" value={settings.eveningTime} disabled={!settings.eveningEnabled} aria-label="저녁 브리핑 시각" onChange={(event) => update({ eveningTime: event.target.value })} />
        </div>
      </div>
      {permission !== 'granted' && (settings.morningEnabled || settings.eveningEnabled) ? (
        <button type="button" className="lifeHubBriefingPermission" onClick={requestNotifications}>휴대폰 알림 켜기</button>
      ) : null}
      <p className="lifeHubBriefingSettingStatus" role="status">{message || (permission === 'granted' ? '알림 사용 가능' : '브리핑 카드는 항상 볼 수 있고, 알림은 별도로 허용해야 해요.')}</p>
    </section>
  );
}
