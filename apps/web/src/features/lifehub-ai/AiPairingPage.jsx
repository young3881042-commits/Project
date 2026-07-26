import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import { ADVANCED_PERMISSION_OPTIONS } from './pairingModel.js';
import PairedPcList from './PairedPcList.jsx';
import PairingSecurityNotice from './PairingSecurityNotice.jsx';
import useAiPairing from './useAiPairing.js';

export default function AiPairingPage({ navigate }) {
  const pairing = useAiPairing();
  const {
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
    retrySecurityCheck,
    update,
    togglePermission,
    cancelPendingPairing,
    connectLocal,
    submitPairing,
    revoke
  } = pairing;

  return (
    <div className="lifeHubPage lifeHubAiSettingsPage">
      <section className="lifeHubAiPageIntro">
        <button type="button" className="lifeHubAiBack" onClick={() => navigate('/diet')} aria-label="식단으로 돌아가기">
          <MemoNavIcon type="chevronLeft" />
        </button>
        <div>
          <span>휴대폰 연결</span>
          <h2>Orbit 연결하기</h2>
          <p>{localConnectionAvailable ? '이 PC에서는 버튼 한 번으로 바로 연결할 수 있어요.' : '관리자 화면의 6자리 코드를 입력하고 PC에서 승인해주세요.'}</p>
        </div>
      </section>

      <PairingSecurityNotice
        nativeBridgeDetected={nativeBridgeDetected}
        secureStorageAvailable={secureStorageAvailable}
        onRetry={retrySecurityCheck}
      />

      <form
        className={`lifeHubAiPairForm ${pairingLocked ? 'waiting' : ''}`}
        onSubmit={submitPairing}
        aria-describedby={notice ? 'lifehub-pairing-notice' : undefined}
      >
        <header>
          <div><span>Bridge 연결</span><h3>{localConnectionAvailable ? '로컬에서 바로 사용' : '6자리 코드 입력'}</h3></div>
          <span className={`lifeHubAiStatusPill ${visibleStatus.kind}`}><i />{visibleStatus.label}</span>
        </header>

        {localConnectionAvailable ? (
          <button type="button" className="lifeHubAiLocalConnectButton" onClick={connectLocal} disabled={pairingLocked || pairingComplete}>
            <MemoNavIcon type={submitting ? 'search' : 'link'} />
            {pairingComplete ? '로컬 Bridge 연결 완료' : submitting ? '로컬 Bridge 연결 중…' : '로컬 Bridge 바로 사용 · 전체 권한'}
          </button>
        ) : null}

        <details className="lifeHubAiRemotePairing" open={localConnectionAvailable ? undefined : true}>
          <summary>{localConnectionAvailable ? '다른 PC를 6자리 코드로 연결' : '연결 코드 입력'}</summary>
          <ol className="lifeHubAiPairSteps" aria-label="연결 방법">
            <li><strong>1</strong><span>관리자 화면에서<br />코드 발급</span></li>
            <li><strong>2</strong><span>휴대폰에<br />6자리 입력</span></li>
            <li><strong>3</strong><span>PC에서 승인하면<br />자동 연결</span></li>
          </ol>

          <div className="lifeHubAiAddressGrid code">
            <label>
              <span>6자리 인증 코드</span>
              <input
                className="lifeHubAiPairCode"
                value={form.code}
                onChange={(event) => update('code', event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                pattern="[0-9]{6}"
                aria-invalid={codeInvalid}
                disabled={pairingLocked}
                required={!localConnectionAvailable}
              />
            </label>
            <label>
              <span>기기 이름</span>
              <input value={form.deviceName} onChange={(event) => update('deviceName', event.target.value.slice(0, 80))} placeholder="예: 민지의 휴대폰" disabled={pairingLocked} required />
            </label>
          </div>

          <div className="lifeHubAiRequiredPermission">
            <MemoNavIcon type="spark" />
            <span><strong>AI 대화 · 음식 사진 분석</strong><small>Orbit의 기본 기능에 필요한 권한입니다.</small></span>
            <em>필수</em>
          </div>

          <details className="lifeHubAiAdvancedPermissions">
            <summary>고급 권한 (선택)<small>프로젝트 파일·명령·Git 기능</small></summary>
            <fieldset className="lifeHubAiPermissions" disabled={pairingLocked}>
              <legend>추가로 허용할 기능</legend>
              {ADVANCED_PERMISSION_OPTIONS.map((permission) => (
                <label key={permission.key}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.permissions[permission.key])}
                    onChange={() => togglePermission(permission.key)}
                  />
                  <span><strong>{permission.label}</strong><small>{permission.detail}</small></span>
                </label>
              ))}
            </fieldset>
          </details>

          {!pairingComplete ? (
            <button type="submit" className="lifeHubAiPrimaryButton" disabled={pairingLocked || (nativeBridgeDetected && !secureStorageAvailable)}>
              <MemoNavIcon type={pairingLocked ? 'search' : 'link'} />
              {pendingId ? 'PC 승인 기다리는 중…' : submitting ? '연결 확인 중…' : '6자리 코드로 연결하기'}
            </button>
          ) : null}
        </details>

        {notice ? (
          <p
            id="lifehub-pairing-notice"
            className={`lifeHubAiFormNotice ${notice.tone}`}
            role={notice.tone === 'error' ? 'alert' : 'status'}
            aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
          >{notice.text}</p>
        ) : null}

        {pairingComplete || pairingLocked ? (
          <div className="lifeHubAiPairActions" aria-busy={pairingLocked}>
            {pairingComplete ? (
            <button type="button" className="lifeHubAiPrimaryButton" onClick={() => navigate('/diet')}>
              <MemoNavIcon type="camera" />
              연결 완료 · 음식 사진 분석 시작
            </button>
            ) : null}
            {pairingLocked ? (
              <button type="button" className="lifeHubAiSecondaryButton" onClick={cancelPendingPairing}>연결 대기 중단</button>
            ) : null}
          </div>
        ) : null}
        <p className="lifeHubAiPairHelp">로컬 연결은 코드와 관리자 승인이 필요 없습니다. 다른 기기에서 접속할 때만 6자리 연결 절차를 사용합니다.</p>
      </form>

      <PairedPcList
        pcs={pcs}
        selected={selected}
        choosePc={choosePc}
        revoke={revoke}
        revokingId={revokingId}
      />
    </div>
  );
}
