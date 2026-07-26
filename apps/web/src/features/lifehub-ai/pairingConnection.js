import { savePairedPc } from './bridgeStorage.js';
import { pairingPayload, pairingToken } from './pairingModel.js';

export async function saveBridgeConnectionResponse({
  response,
  baseUrl,
  deviceName,
  fallbackPermissions
}) {
  const data = pairingPayload(response);
  const nativeTokenStored = data.tokenStored === true;
  const browserToken = nativeTokenStored ? '' : pairingToken(response);
  const pcId = String(data.device?.id || data.pcId || data.bridgeId || data.id || '').trim();
  if (!pcId) throw new Error('Bridge가 PC 식별자를 반환하지 않았습니다.');

  return savePairedPc({
    id: pcId,
    baseUrl,
    name: data.bridge?.name || data.pcName || data.hostName || new URL(baseUrl).hostname,
    deviceName,
    permissions: data.device?.permissions || data.permissions || fallbackPermissions,
    pairedAt: data.pairedAt
  }, browserToken, nativeTokenStored ? {
    tokenStored: true,
    tokenKey: String(data.tokenKey || '')
  } : null);
}
