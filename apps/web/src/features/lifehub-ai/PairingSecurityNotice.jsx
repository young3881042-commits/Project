import MemoNavIcon from '../../components/MemoNavIcon.jsx';

export default function PairingSecurityNotice({ nativeBridgeDetected, secureStorageAvailable, onRetry }) {
  if (nativeBridgeDetected && !secureStorageAvailable) {
    return (
      <aside className="lifeHubAiSecurityNotice warning">
        <MemoNavIcon type="shield" />
        <div>
          <strong>안전한 연결을 준비하고 있어요</strong>
          <p>휴대폰 보안 저장소가 준비되면 연결할 수 있습니다. 잠시 후 다시 시도해주세요.</p>
        </div>
        <button type="button" className="lifeHubAiSecurityRetry" onClick={onRetry}>다시 확인</button>
      </aside>
    );
  }

  if (!secureStorageAvailable) {
    return (
      <aside className="lifeHubAiSecurityNotice warning">
        <MemoNavIcon type="shield" />
        <div>
          <strong>브라우저에서는 임시로 연결돼요</strong>
          <p>새로고침한 뒤에는 로컬 연결 버튼만 다시 누르면 됩니다.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="lifeHubAiSecurityNotice">
      <MemoNavIcon type="shield" />
      <div>
        <strong>연결 정보를 안전하게 보호해요</strong>
        <p>이 휴대폰의 연결 키는 Android 보안 저장소에만 보관합니다.</p>
      </div>
    </aside>
  );
}
