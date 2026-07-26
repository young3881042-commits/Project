import { useEffect, useRef, useState } from 'react';
import {
  normalizeBridgeBaseUrl,
  pollPairingClaim,
  requestLocalBridgeConnection,
  requestPairing
} from './bridgeClient.js';
import { forgetPairedPc, hasNativeSecureStorage } from './bridgeStorage.js';
import { saveBridgeConnectionResponse } from './pairingConnection.js';
import {
  initialPairingForm,
  localBridgeConnectionAvailable,
  pairingErrorNotice,
  pairingPayload,
  pairingToken,
  pendingPairingId
} from './pairingModel.js';
import useBridgeConnection, { bridgeClientForPc } from './useBridgeConnection.js';
import { hasNativeBridgeApi } from './nativeBridgeTransport.js';

function requestWasCancelled(error, controller) {
  return controller.signal.aborted || error?.code === 'CANCELLED' || error?.name === 'AbortError';
}

export default function useAiPairing() {
  const { pcs, pc: selected, status, reloadPcs, choosePc } = useBridgeConnection();
  const [form, setForm] = useState(() => initialPairingForm());
  const [pendingId, setPendingId] = useState('');
  const pendingSecretRef = useRef('');
  const pendingExpiresAtRef = useRef('');
  const pairingRequestRef = useRef(null);
  const [notice, setNotice] = useState(null);
  const [pairingComplete, setPairingComplete] = useState(false);
  const [, setSecurityCheckVersion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState('');
  const secureStorageAvailable = hasNativeSecureStorage();
  const nativeBridgeDetected = hasNativeBridgeApi();
  const localConnectionAvailable = localBridgeConnectionAvailable();
  const pairingLocked = submitting || Boolean(pendingId);
  const codeInvalid = notice?.field === 'code';
  const visibleStatus = pairingComplete
    ? { kind: 'connected', label: '연결 완료' }
    : pendingId
      ? { kind: 'checking', label: 'PC 승인 대기 중' }
      : submitting
        ? { kind: 'checking', label: '연결 확인 중' }
        : status;

  useEffect(() => () => {
    pairingRequestRef.current?.abort();
    pairingRequestRef.current = null;
  }, []);

  const clearPendingState = () => {
    setPendingId('');
    pendingSecretRef.current = '';
    pendingExpiresAtRef.current = '';
  };

  const clearCompletedState = () => {
    setPairingComplete(false);
    setNotice((current) => current?.tone === 'success' ? null : current);
  };

  const update = (key, value) => {
    clearCompletedState();
    setForm((current) => ({ ...current, [key]: value }));
  };

  const togglePermission = (key) => {
    clearCompletedState();
    setForm((current) => ({
      ...current,
      permissions: { ...current.permissions, [key]: key === 'chat' ? true : !current.permissions[key] }
    }));
  };

  const saveConnection = async (response, baseUrl, successText) => {
    await saveBridgeConnectionResponse({
      response,
      baseUrl,
      deviceName: form.deviceName,
      fallbackPermissions: form.permissions
    });
    clearPendingState();
    setForm((current) => ({ ...current, code: '' }));
    reloadPcs();
    setPairingComplete(true);
    setNotice({ tone: 'success', text: successText });
  };

  const cancelPendingPairing = () => {
    pairingRequestRef.current?.abort();
    pairingRequestRef.current = null;
    setSubmitting(false);
    clearPendingState();
    setForm((current) => ({ ...current, code: '' }));
    setNotice({ tone: 'progress', text: '이 휴대폰의 연결 대기를 중단했습니다. 다시 연결하려면 새 코드를 입력해주세요.' });
  };

  const connectLocal = async () => {
    pairingRequestRef.current?.abort();
    const controller = new AbortController();
    pairingRequestRef.current = controller;
    setPairingComplete(false);
    setSubmitting(true);
    setNotice({ tone: 'progress', text: '이 PC의 로컬 Bridge에 바로 연결하고 있어요.' });
    try {
      const baseUrl = normalizeBridgeBaseUrl(form.address, form.port);
      const response = await requestLocalBridgeConnection(form, { signal: controller.signal });
      await saveConnection(response, baseUrl, '로컬 Bridge에 바로 연결됐어요. 코드 입력이나 PC 승인은 필요하지 않습니다.');
    } catch (error) {
      if (requestWasCancelled(error, controller)) return;
      setNotice({
        tone: 'error',
        text: error?.status === 403
          ? '로컬 접속으로 확인되지 않았습니다. 이 PC에서 localhost 웹을 열었는지 확인해주세요.'
          : `로컬 Bridge에 연결하지 못했습니다. ${error.message}`
      });
    } finally {
      if (pairingRequestRef.current === controller) pairingRequestRef.current = null;
      if (!controller.signal.aborted) setSubmitting(false);
    }
  };

  const submitPairing = async (event) => {
    event?.preventDefault();
    if (!pendingId && !/^\d{6}$/.test(form.code)) {
      setNotice({ tone: 'error', field: 'code', text: '관리자 화면에 표시된 6자리 연결 코드를 입력해주세요.' });
      return;
    }
    pairingRequestRef.current?.abort();
    const controller = new AbortController();
    pairingRequestRef.current = controller;
    setPairingComplete(false);
    setSubmitting(true);
    setNotice({ tone: 'progress', text: pendingId ? 'PC 승인 결과를 확인하고 있어요.' : '안전한 연결을 준비하고 있어요.' });
    try {
      const baseUrl = normalizeBridgeBaseUrl(form.address, form.port);
      let response = pendingId ? null : await requestPairing(form, { signal: controller.signal });
      let data = pairingPayload(response);
      let nativeTokenStored = data.tokenStored === true;
      let browserToken = nativeTokenStored ? '' : pairingToken(response);

      if (pendingId || (!browserToken && !nativeTokenStored)) {
        const nextPendingId = pendingPairingId(response) || pendingId;
        const nextPendingSecret = String(data.requestSecret || pendingSecretRef.current || '');
        const nextExpiresAt = String(data.expiresAt || pendingExpiresAtRef.current || '');
        if (!nextPendingId || !nextPendingSecret) {
          throw new Error('Bridge가 페어링 승인 확인 정보를 반환하지 않았습니다.');
        }
        setPendingId(nextPendingId);
        pendingSecretRef.current = nextPendingSecret;
        pendingExpiresAtRef.current = nextExpiresAt;
        setNotice({
          tone: 'pending',
          text: data.message || 'PC에서 기기와 권한을 승인하면 이 화면에서 자동으로 연결합니다.'
        });
        response = await pollPairingClaim({
          address: form.address,
          port: form.port,
          requestId: nextPendingId,
          requestSecret: nextPendingSecret
        }, {
          signal: controller.signal,
          expiresAt: nextExpiresAt,
          onPending: () => setNotice({ tone: 'pending', text: 'PC 승인을 기다리고 있어요. 승인하면 자동으로 연결합니다.' }),
          onRetry: () => setNotice({ tone: 'progress', text: '잠시 연결이 불안정해 다시 확인하고 있어요.' })
        });
        data = pairingPayload(response);
        nativeTokenStored = data.tokenStored === true;
        browserToken = nativeTokenStored ? '' : pairingToken(response);
      }
      await saveConnection(response, baseUrl, '연결이 완료됐어요. 이제 휴대폰에서 음식 사진을 분석할 수 있습니다.');
    } catch (error) {
      if (requestWasCancelled(error, controller)) return;
      const claimWasPending = Boolean(pendingSecretRef.current);
      if ([401, 403, 409, 410].includes(error?.status)) clearPendingState();
      if ([403, 409, 410].includes(error?.status) || (error?.status === 401 && claimWasPending)) {
        setForm((current) => ({ ...current, code: '' }));
      }
      setNotice(pairingErrorNotice(error, claimWasPending));
    } finally {
      if (pairingRequestRef.current === controller) pairingRequestRef.current = null;
      if (!controller.signal.aborted) setSubmitting(false);
    }
  };

  const revoke = async (pc) => {
    if (!window.confirm(`${pc.name} 페어링을 해제하고 이 기기 토큰을 폐기할까요?`)) return;
    setRevokingId(pc.id);
    setNotice(null);
    try {
      await bridgeClientForPc(pc).revoke({ deviceId: pc.id });
      await forgetPairedPc(pc.id);
      reloadPcs();
      setNotice({ tone: 'success', text: `${pc.name}의 기기 토큰을 폐기하고 연결을 해제했습니다.` });
    } catch (error) {
      if (error?.status === 401 || error?.status === 404) {
        await forgetPairedPc(pc.id);
        reloadPcs();
        setNotice({ tone: 'success', text: '이미 폐기된 연결 정보를 이 기기에서도 제거했습니다.' });
      } else {
        setNotice({ tone: 'error', text: `토큰 폐기를 확인하지 못했습니다. PC Bridge 연결 후 다시 시도해주세요. ${error.message}` });
      }
    } finally {
      setRevokingId('');
    }
  };

  return {
    pcs,
    selected,
    choosePc,
    form,
    pendingId,
    notice,
    pairingComplete,
    submitting,
    revokingId,
    secureStorageAvailable,
    nativeBridgeDetected,
    localConnectionAvailable,
    pairingLocked,
    codeInvalid,
    visibleStatus,
    retrySecurityCheck: () => setSecurityCheckVersion((value) => value + 1),
    update,
    togglePermission,
    cancelPendingPairing,
    connectLocal,
    submitPairing,
    revoke
  };
}
