import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import { formatNumber } from '../../utils/lifeHubFormatters.js';

function checkedTime(value) {
  if (!value) return '아직 확인 전';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '확인 시간 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export default function CardTransactionImportPanel({
  cardImport,
  onManualEntry
}) {
  if (!cardImport.nativeAvailable) {
    return (
      <section className="lifeHubNotificationNotice granted" aria-label="결제 앱 사용 내역 수동 기록 안내">
        <MemoNavIcon type="chart" />
        <div>
          <strong>결제 앱 알림 확인 후 기록</strong>
          <span>이 브라우저에서는 다른 앱의 알림을 읽지 않아요. 결제 금액과 사용처를 확인한 뒤 직접 입력해주세요.</span>
        </div>
        <button type="button" onClick={onManualEntry}>지출 입력</button>
      </section>
    );
  }

  const accessEnabled = cardImport.access === 'enabled';
  return (
    <section className="lifeHubCardImportPanel" aria-labelledby="cardImportTitle">
      <header>
        <span className="lifeHubCardImportIcon"><MemoNavIcon type="chart" /></span>
        <div>
          <strong id="cardImportTitle">결제 알림 자동 가져오기</strong>
          <p>실제 결제 승인만 보수적으로 가져오며 송금·이체·입출금은 대상이 아닙니다.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={cardImport.enabled}
          aria-label="결제 알림 자동 가져오기"
          className={cardImport.enabled ? 'cardImportSwitch active' : 'cardImportSwitch'}
          disabled={cardImport.syncing}
          onClick={cardImport.toggleEnabled}
        >
          {cardImport.enabled ? '켜짐' : '꺼짐'}
        </button>
      </header>

      <p className="lifeHubCardImportPrivacy">
        선택한 앱의 알림은 기기 안에서만 확인해요. 알림 원문·잔액·계좌·카드번호는 표시하거나 저장하지 않고, 검증된 금액·사용처·시각만 이 기기의 가계부에 저장합니다.
      </p>

      <div className="lifeHubCardImportPermission lifeHubCardImportSources" role="group" aria-labelledby="cardImportSourcesTitle">
        <strong id="cardImportSourcesTitle">가져올 결제 앱</strong>
        <p>삼성월렛과 카카오페이 앱 중 사용할 앱만 선택하세요. 카카오톡 알림톡은 읽지 않아요.</p>
        <div>
          {cardImport.sources.map((source) => (
            <label key={source.id}>
              <input
                type="checkbox"
                checked={cardImport.selectedSources.includes(source.id)}
                disabled={cardImport.syncing}
                onChange={() => cardImport.toggleSource(source.id)}
              />
              {' '}{source.label}
            </label>
          ))}
        </div>
      </div>

      {cardImport.enabled && !accessEnabled ? (
        <div className="lifeHubCardImportPermission">
          <strong>Android 알림 접근이 필요해요</strong>
          <p>알림 접근은 모든 앱의 알림을 볼 수 있는 넓은 특수 권한입니다. Orbit은 선택한 삼성월렛·카카오페이 알림만 기기 안에서 확인해 실제 결제 승인만 가져옵니다.</p>
          <p>권한을 허용하기 전의 과거 결제 내역은 가져올 수 없어요.</p>
          <div>
            <button type="button" className="primary" onClick={cardImport.openAccessSettings}>알림 접근 설정</button>
            <button type="button" onClick={cardImport.openAppSettings}>앱 정보 열기</button>
          </div>
          <details>
            <summary>‘제한된 설정’으로 막힐 때</summary>
            <p>인터넷에서 설치한 APK는 Android가 민감한 설정을 막을 수 있어요. 앱 정보의 오른쪽 위 메뉴에서 ‘제한된 설정 허용’을 먼저 선택하고 다시 알림 접근을 켜주세요.</p>
          </details>
        </div>
      ) : null}

      {cardImport.enabled && accessEnabled ? (
        <div className="lifeHubCardImportStatus">
          <div>
            <span>오늘 자동 가져오기</span>
            <strong>{formatNumber(cardImport.summary.today)}건</strong>
          </div>
          <div>
            <span>누적 자동 가져오기</span>
            <strong>{formatNumber(cardImport.summary.total)}건</strong>
          </div>
          <div>
            <span>최근 확인</span>
            <strong>{checkedTime(cardImport.lastCheckedAt)}</strong>
          </div>
          <button type="button" className="primary" disabled={cardImport.syncing} onClick={cardImport.pull}>
            {cardImport.syncing ? '가져오는 중…' : '지금 가져오기'}
          </button>
          <small>잘못 인식된 결제는 ‘내역’ 탭의 최근 거래에서 바로 삭제할 수 있어요.</small>
        </div>
      ) : null}

      {cardImport.message ? (
        <p className={`lifeHubCardImportMessage ${cardImport.messageTone}`} role="status" aria-live="polite">
          {cardImport.message}
        </p>
      ) : null}
    </section>
  );
}
