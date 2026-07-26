import { useCallback, useEffect, useMemo, useState } from 'react';
import { LifeHubBridgeClient } from './bridgeClient.js';
import { listPairedPcs, readVolatileDeviceToken, selectPc, selectedPc } from './bridgeStorage.js';

function normalizeConnection(pc, health, device) {
  const connected = health?.ok !== false && device?.connected !== false && device?.revoked !== true;
  return {
    kind: connected ? 'connected' : 'disconnected',
    label: connected ? 'PC 연결됨' : '연결 안 됨',
    pcName: String(device?.bridge?.name || device?.bridge?.host || device?.pcName || device?.hostName || health?.name || pc?.name || '내 PC'),
    codexLoggedIn: device?.codex?.loggedIn ?? device?.codexLoggedIn ?? health?.codexLoggedIn ?? health?.codex?.loggedIn ?? null,
    lanEnabled: device?.bridge?.lanEnabled ?? device?.lanEnabled ?? health?.lanEnabled ?? null,
    permissions: device?.device?.permissions || device?.permissions || pc?.permissions || {},
    capabilities: device?.capabilities || health?.capabilities || {},
    detail: connected ? '로컬 LifeHub Bridge와 연결되었습니다.' : 'PC Bridge 상태를 확인해주세요.'
  };
}

export function bridgeClientForPc(pc) {
  if (!pc) return null;
  return new LifeHubBridgeClient({
    baseUrl: pc.baseUrl,
    getToken: () => readVolatileDeviceToken(pc.id),
    tokenKey: `lifehub.bridge.token:${pc.id}`
  });
}

export default function useBridgeConnection({ poll = true } = {}) {
  const [pcs, setPcs] = useState(() => listPairedPcs());
  const [pc, setPc] = useState(() => selectedPc());
  const [status, setStatus] = useState(() => ({
    kind: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : pc ? 'checking' : 'unpaired',
    label: pc ? '연결 확인 중' : '연결 안 됨',
    pcName: pc?.name || '',
    detail: pc ? 'PC Bridge 상태를 확인하고 있습니다.' : '먼저 PC와 휴대폰을 페어링해주세요.'
  }));
  const client = useMemo(() => bridgeClientForPc(pc), [pc?.id, pc?.baseUrl]);

  const reloadPcs = useCallback(() => {
    const nextPcs = listPairedPcs();
    const nextSelected = selectedPc();
    setPcs(nextPcs);
    setPc(nextSelected);
    if (!nextSelected) {
      setStatus({ kind: 'unpaired', label: '연결 안 됨', pcName: '', detail: '먼저 PC와 휴대폰을 페어링해주세요.' });
    }
  }, []);

  const refresh = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus({ kind: 'offline', label: '네트워크 끊김', pcName: pc?.name || '', detail: '네트워크가 복구되면 PC 연결을 다시 확인합니다.' });
      return null;
    }
    if (!pc || !client) {
      setStatus({ kind: 'unpaired', label: '연결 안 됨', pcName: '', detail: '먼저 PC와 휴대폰을 페어링해주세요.' });
      return null;
    }
    setStatus((current) => ({ ...current, kind: 'checking', label: '연결 확인 중', pcName: pc.name }));
    try {
      const [health, device] = await Promise.all([
        client.health().catch(() => ({ ok: true })),
        client.deviceStatus()
      ]);
      const next = normalizeConnection(pc, health, device);
      setStatus(next);
      return { health, device, status: next };
    } catch (error) {
      const offline = error?.code === 'OFFLINE';
      setStatus({
        kind: offline ? 'offline' : error?.status === 401 ? 'revoked' : 'disconnected',
        label: offline ? '네트워크 끊김' : error?.status === 401 ? '페어링 만료' : '연결 안 됨',
        pcName: pc.name,
        detail: error?.status === 401 ? '기기 토큰이 만료되었거나 폐기되었습니다. 다시 페어링해주세요.' : error.message
      });
      return null;
    }
  }, [client, pc]);

  const choosePc = useCallback((pcId) => {
    selectPc(pcId);
    const next = listPairedPcs().find((item) => item.id === pcId) || null;
    setPc(next);
  }, []);

  useEffect(() => {
    const handleStorage = () => reloadPcs();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('lifehub:bridge-storage-changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('lifehub:bridge-storage-changed', handleStorage);
    };
  }, [reloadPcs]);

  useEffect(() => {
    const handleOffline = () => setStatus({ kind: 'offline', label: '네트워크 끊김', pcName: pc?.name || '', detail: '네트워크가 복구되면 PC 연결을 다시 확인합니다.' });
    const handleOnline = () => refresh();
    const handleNativeNetwork = (event) => {
      if (event?.detail?.connected === false) handleOffline();
      else refresh();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('lifehub:native-network-status', handleNativeNetwork);
    refresh();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('lifehub:native-network-status', handleNativeNetwork);
    };
  }, [refresh, pc?.id]);

  useEffect(() => {
    if (!poll || !pc) return undefined;
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [poll, pc?.id, refresh]);

  return { pcs, pc, client, status, refresh, choosePc, reloadPcs };
}
