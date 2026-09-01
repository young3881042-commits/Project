import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CARD_IMPORT_SOURCE_IDS,
  CARD_IMPORT_SOURCES,
  acknowledgePendingCardTransactions,
  configureNativeCardImport,
  hasNativeCardImportApi,
  nativeCardImportCapabilities,
  normalizeCardImportSources,
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
import { repairExistingKakaoPayEntries } from './kakaoPayMerchant.js';

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
  categorySettings,
  today,
  readBudget,
  normalizeBudget,
  saveBudget,
  onSaved
}) {
  const target = currentTarget();
  const normalizedOwner = normalizeCardImportOwner(owner);
  const [selectedSources, setSelectedSources] = useState(() => (
    readCardImportSources(normalizedOwner)
  ));
  const [capabilities, setCapabilities] = useState(() => nativeCardImportCapabilities(target));
  const [syncing, setSyncing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('neutral');
  const mountedRef = useRef(true);
  const inFlightRef = useRef(null);
  const lastAutomaticPullRef = useRef(0);
  const lastMerchantRepairSignatureRef = useRef('');
  const servicesRef = useRef(null);
  servicesRef.current = { readBudget, normalizeBudget, saveBudget, onSaved, categorySettings };
  const enabled = selectedSources.length > 0;

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

  const pull = useCallback(({
    manual = false,
    forceEnabled = false,
    sourceSelection = selectedSources
  } = {}) => {
    const requestSources = normalizeCardImportSources(sourceSelection);
    if ((!requestSources.length && !forceEnabled) || !hasNativeCardImportApi(target)) {
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
      sources: requestSources,
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
        categorySettings: services.categorySettings,
        selectedSources: requestSources,
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
  }, [normalizedOwner, refreshCapabilities, selectedSources, target]);

  const persistSources = useCallback((sources) => {
    if (!hasNativeCardImportApi(target)) return null;
    const nextSources = normalizeCardImportSources(sources);
    const stored = saveCardImportSources(normalizedOwner, nextSources);
    if (!stored.saved) {
      setMessage('이 기기에 자동 가져오기 설정을 저장하지 못했어요.');
      setMessageTone('error');
      return null;
    }
    if (!configureNativeCardImport({ owner: normalizedOwner, sources: stored.sources, target })) {
      saveCardImportSources(normalizedOwner, selectedSources);
      setMessage('결제 알림 자동 가져오기 설정을 변경하지 못했어요.');
      setMessageTone('error');
      return null;
    }
    setSelectedSources(stored.sources);
    return stored.sources;
  }, [normalizedOwner, selectedSources, target]);

  const toggleEnabled = useCallback(() => {
    const nextSources = enabled ? [] : [CARD_IMPORT_SOURCE_IDS[0]];
    const storedSources = persistSources(nextSources);
    if (!storedSources) return false;
    const nextEnabled = storedSources.length > 0;
    setMessage(nextEnabled
      ? '결제 알림 자동 가져오기를 켰어요. 필요한 결제 앱을 선택해주세요.'
      : '결제 알림 자동 가져오기를 껐어요.');
    setMessageTone('success');
    const nextCapabilities = refreshCapabilities();
    if (nextEnabled && nextCapabilities?.access === 'enabled') {
      void pull({ manual: true, forceEnabled: true, sourceSelection: storedSources });
    }
    return true;
  }, [enabled, persistSources, pull, refreshCapabilities]);

  const toggleSource = useCallback((sourceId) => {
    const normalized = normalizeCardImportSources([sourceId]);
    if (normalized.length !== 1) return false;
    const id = normalized[0];
    const wasSelected = selectedSources.includes(id);
    const nextSources = wasSelected
      ? selectedSources.filter((source) => source !== id)
      : normalizeCardImportSources([...selectedSources, id]);
    const storedSources = persistSources(nextSources);
    if (!storedSources) return false;
    const label = CARD_IMPORT_SOURCES.find((source) => source.id === id)?.label || '결제 앱';
    setMessage(`${label} 자동 가져오기를 ${wasSelected ? '껐어요.' : '켰어요.'}`);
    setMessageTone('success');
    const nextCapabilities = refreshCapabilities();
    if (!wasSelected && nextCapabilities?.access === 'enabled') {
      void pull({ manual: true, forceEnabled: true, sourceSelection: storedSources });
    }
    return true;
  }, [persistSources, pull, refreshCapabilities, selectedSources]);

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
    const signature = JSON.stringify({
      owner: normalizedOwner,
      settings: categorySettings,
      entries: (Array.isArray(budgetEntries) ? budgetEntries : []).map((entry) => [
        entry?.id,
        entry?.memo,
        entry?.category,
        entry?.source,
        entry?.origin?.kind,
        entry?.origin?.source
      ])
    });
    if (lastMerchantRepairSignatureRef.current === signature) return;
    lastMerchantRepairSignatureRef.current = signature;

    const services = servicesRef.current;
    let current;
    try {
      current = services.readBudget?.();
    } catch {
      return;
    }
    const repaired = repairExistingKakaoPayEntries(current, services.categorySettings);
    if (!repaired.changed) return;
    let result;
    try {
      result = services.saveBudget?.(repaired.items);
    } catch {
      result = null;
    }
    if (result?.saved === true) {
      if (mountedRef.current) {
        setMessage(`기존 카카오페이 상호명 ${repaired.changed}건을 정리했어요.`);
        setMessageTone('success');
      }
      services.onSaved?.();
    }
  }, [budgetEntries, categorySettings, normalizedOwner]);

  useEffect(() => {
    mountedRef.current = true;
    const storedSources = readCardImportSources(normalizedOwner);
    setSelectedSources(storedSources);
    const current = refreshCapabilities();
    if (current) {
      configureNativeCardImport({
        owner: normalizedOwner,
        sources: storedSources,
        target
      });
      if (storedSources.length && current.access === 'enabled') {
        void pull({ forceEnabled: true, sourceSelection: storedSources });
      }
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
    selectedSources,
    sources: CARD_IMPORT_SOURCES,
    summary,
    syncing,
    toggleEnabled,
    toggleSource
  };
}
