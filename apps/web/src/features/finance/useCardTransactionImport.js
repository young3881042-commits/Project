import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  acknowledgePendingCardTransactions,
  configureNativeCardImport,
  hasNativeCardImportApi,
  nativeCardImportCapabilities,
  normalizeCardImportOwner,
  openNativeCardImportAppSettings,
  openNativeCardNotificationAccessSettings,
  requestPendingCardTransactions
} from './nativeCardTransactions.js';
import {
  cardImportSummary,
  importCardTransactionBatch,
  readCardImportSources,
  saveCardImportSources
} from './cardTransactionImport.js';

const SAMSUNG_WALLET_SOURCE = 'samsung-wallet';
const AUTOMATIC_PULL_THROTTLE_MS = 30 * 1000;

function currentTarget() {
  return typeof window === 'undefined' ? null : window;
}

function resultMessage(result) {
  if (result.status === 'imported') {
    return result.acknowledged
      ? `새 결제 ${result.imported}건을 가계부에 저장했어요.`
      : `새 결제 ${result.imported}건을 저장했고 알림 정리는 다음에 다시 시도해요.`;
  }
  if (result.status === 'ack_failed') {
    return result.imported
      ? `새 결제 ${result.imported}건은 저장했고 알림 정리는 다음에 다시 시도해요.`
      : '이미 저장된 결제를 확인했지만 알림 정리는 다음에 다시 시도해요.';
  }
  if (result.status === 'duplicates') {
    return result.duplicates
      ? `이미 저장된 결제 ${result.duplicates}건을 중복 없이 확인했어요.`
      : '새로 가져올 결제가 없어요.';
  }
  if (result.status === 'empty') return '새로 가져올 실제 결제 승인이 없어요.';
  return '결제를 저장하지 못했어요. 알림은 정리하지 않았으니 다시 시도해주세요.';
}

export function useCardTransactionImport({
  owner,
  budgetEntries,
  today,
  readBudget,
  normalizeBudget,
  saveBudget,
  onSaved
}) {
  const target = currentTarget();
  const normalizedOwner = normalizeCardImportOwner(owner);
  const [enabled, setEnabled] = useState(() => (
    readCardImportSources(normalizedOwner).includes(SAMSUNG_WALLET_SOURCE)
  ));
  const [capabilities, setCapabilities] = useState(() => nativeCardImportCapabilities(target));
  const [syncing, setSyncing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('neutral');
  const mountedRef = useRef(true);
  const inFlightRef = useRef(null);
  const lastAutomaticPullRef = useRef(0);
  const servicesRef = useRef(null);
  servicesRef.current = { readBudget, normalizeBudget, saveBudget, onSaved };

  const summary = useMemo(
    () => cardImportSummary(budgetEntries, today),
    [budgetEntries, today]
  );
  const nativeAvailable = hasNativeCardImportApi(target) && Boolean(capabilities);
  const access = capabilities?.access || (hasNativeCardImportApi(target) ? 'disabled' : 'unsupported');

  const refreshCapabilities = useCallback(() => {
    const next = nativeCardImportCapabilities(target);
    if (mountedRef.current) setCapabilities(next);
    return next;
  }, [target]);

  const pull = useCallback(({ manual = false, forceEnabled = false } = {}) => {
    if ((!enabled && !forceEnabled) || !hasNativeCardImportApi(target)) {
      return Promise.resolve({ status: 'disabled', imported: 0, duplicates: 0 });
    }
    if (inFlightRef.current) return inFlightRef.current;
    const now = Date.now();
    if (!manual && now - lastAutomaticPullRef.current < AUTOMATIC_PULL_THROTTLE_MS) {
      return Promise.resolve({ status: 'throttled', imported: 0, duplicates: 0 });
    }
    const currentCapabilities = refreshCapabilities();
    if (!currentCapabilities || currentCapabilities.access !== 'enabled') {
      if (manual && mountedRef.current) {
        setMessage('먼저 Android 설정에서 Orbit의 알림 접근을 켜주세요.');
        setMessageTone('warning');
      }
      return Promise.resolve({ status: 'access_disabled', imported: 0, duplicates: 0 });
    }

    if (!manual) lastAutomaticPullRef.current = now;
    if (mountedRef.current) setSyncing(true);
    const operation = requestPendingCardTransactions({
      owner: normalizedOwner,
      sources: [SAMSUNG_WALLET_SOURCE],
      target
    }).then(async (peek) => {
      if (mountedRef.current) {
        setCapabilities((current) => current ? {
          ...current,
          access: peek.access,
          pendingCount: peek.pendingCount
        } : current);
      }
      const services = servicesRef.current;
      const result = await importCardTransactionBatch(peek.items, {
        selectedSources: [SAMSUNG_WALLET_SOURCE],
        readBudget: services.readBudget,
        normalizeBudget: services.normalizeBudget,
        saveBudget: services.saveBudget,
        acknowledgeDecisions: (decisions) => acknowledgePendingCardTransactions({
          owner: normalizedOwner,
          decisions,
          target
        })
      });
      if (result.imported > 0) services.onSaved?.();
      if (mountedRef.current) {
        setLastCheckedAt(new Date().toISOString());
        setMessage(resultMessage(result));
        setMessageTone(result.status === 'failed' ? 'error' : result.status === 'ack_failed' ? 'warning' : 'success');
      }
      return result;
    }).catch((error) => {
      const busy = error?.code === 'busy';
      if (mountedRef.current && !busy) {
        setLastCheckedAt(new Date().toISOString());
        setMessage('결제 알림을 가져오지 못했어요. 잠시 후 다시 시도해주세요.');
        setMessageTone('error');
      }
      return { status: busy ? 'busy' : 'failed', imported: 0, duplicates: 0 };
    }).finally(() => {
      if (inFlightRef.current === operation) inFlightRef.current = null;
      if (mountedRef.current) setSyncing(false);
    });
    inFlightRef.current = operation;
    return operation;
  }, [enabled, normalizedOwner, refreshCapabilities, target]);

  const toggleEnabled = useCallback(() => {
    if (!hasNativeCardImportApi(target)) return false;
    const nextEnabled = !enabled;
    const nextSources = nextEnabled ? [SAMSUNG_WALLET_SOURCE] : [];
    if (!configureNativeCardImport({ owner: normalizedOwner, sources: nextSources, target })) {
      setMessage('삼성월렛 자동 가져오기 설정을 변경하지 못했어요.');
      setMessageTone('error');
      return false;
    }
    const stored = saveCardImportSources(normalizedOwner, nextSources);
    if (!stored.saved) {
      configureNativeCardImport({
        owner: normalizedOwner,
        sources: enabled ? [SAMSUNG_WALLET_SOURCE] : [],
        target
      });
      setMessage('이 기기에 자동 가져오기 설정을 저장하지 못했어요.');
      setMessageTone('error');
      return false;
    }
    setEnabled(nextEnabled);
    setMessage(nextEnabled
      ? '삼성월렛 결제 자동 가져오기를 켰어요.'
      : '삼성월렛 결제 자동 가져오기를 껐어요.');
    setMessageTone('success');
    const nextCapabilities = refreshCapabilities();
    if (nextEnabled && nextCapabilities?.access === 'enabled') {
      void pull({ manual: true, forceEnabled: true });
    }
    return true;
  }, [enabled, normalizedOwner, pull, refreshCapabilities, target]);

  const openAccessSettings = useCallback(() => {
    const opened = openNativeCardNotificationAccessSettings(target);
    if (!opened) {
      setMessage('Android 알림 접근 설정을 열지 못했어요.');
      setMessageTone('error');
    }
    return opened;
  }, [target]);

  const openAppSettings = useCallback(() => {
    const opened = openNativeCardImportAppSettings(target);
    if (!opened) {
      setMessage('앱 정보 설정을 열지 못했어요.');
      setMessageTone('error');
    }
    return opened;
  }, [target]);

  useEffect(() => {
    mountedRef.current = true;
    const current = refreshCapabilities();
    if (current) {
      configureNativeCardImport({
        owner: normalizedOwner,
        sources: enabled ? [SAMSUNG_WALLET_SOURCE] : [],
        target
      });
      if (enabled && current.access === 'enabled') void pull({ forceEnabled: true });
    }
    return () => {
      mountedRef.current = false;
    };
  }, [normalizedOwner]);

  useEffect(() => {
    if (!target || typeof target.addEventListener !== 'function') return undefined;
    const syncOnForeground = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const current = refreshCapabilities();
      if (enabled && current?.access === 'enabled') void pull();
    };
    target.addEventListener('focus', syncOnForeground);
    globalThis.document?.addEventListener?.('visibilitychange', syncOnForeground);
    return () => {
      target.removeEventListener('focus', syncOnForeground);
      globalThis.document?.removeEventListener?.('visibilitychange', syncOnForeground);
    };
  }, [enabled, pull, refreshCapabilities, target]);

  return {
    access,
    capabilities,
    enabled,
    lastCheckedAt,
    message,
    messageTone,
    nativeAvailable,
    openAccessSettings,
    openAppSettings,
    pull: () => pull({ manual: true }),
    summary,
    syncing,
    toggleEnabled
  };
}
