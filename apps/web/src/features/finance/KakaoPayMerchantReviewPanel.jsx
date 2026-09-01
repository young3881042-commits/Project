import { useMemo, useState } from 'react';
import { formatNumber } from '../../utils/lifeHubFormatters.js';
import { kakaoPayEntriesNeedingMerchant } from './kakaoPayMerchant.js';

export default function KakaoPayMerchantReviewPanel({ entries = [], onRepair }) {
  const reviewEntries = useMemo(() => kakaoPayEntriesNeedingMerchant(entries), [entries]);
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState('');
  if (!reviewEntries.length) return null;

  const submit = (event, entry) => {
    event.preventDefault();
    const result = onRepair?.(entry.id, drafts[entry.id] || '');
    if (!result?.saved) {
      setMessage(result?.error || '상호명을 저장하지 못했어요.');
      return;
    }
    setDrafts((current) => ({ ...current, [entry.id]: '' }));
    setMessage(`${result.merchant} 상호명으로 기존 거래를 정리했어요.`);
  };

  return (
    <section className="lifeHubKakaoMerchantReview" aria-labelledby="kakaoMerchantReviewTitle">
      <header>
        <div>
          <strong id="kakaoMerchantReviewTitle">이전 카카오페이 상호명 확인</strong>
          <p>과거 버전이 앱 이름만 저장한 {formatNumber(reviewEntries.length)}건이 있어요. 당시 알림 원문은 보관하지 않아 실제 상호명을 직접 확인해야 합니다.</p>
        </div>
      </header>
      <div className="lifeHubKakaoMerchantReviewList">
        {reviewEntries.map((entry) => (
          <form key={entry.id} onSubmit={(event) => submit(event, entry)}>
            <div>
              <strong>{entry.date} · {formatNumber(entry.amount)}원</strong>
              <small>기존 표시: {entry.memo || '상호명 없음'}</small>
            </div>
            <label>
              <span className="srOnly">{entry.date} 결제 상호명</span>
              <input
                value={drafts[entry.id] || ''}
                maxLength={80}
                onChange={(event) => setDrafts((current) => ({
                  ...current,
                  [entry.id]: event.target.value
                }))}
                placeholder="실제 상호명"
              />
            </label>
            <button type="submit">저장</button>
          </form>
        ))}
      </div>
      {message ? <p className="lifeHubKakaoMerchantReviewMessage" role="status" aria-live="polite">{message}</p> : null}
    </section>
  );
}
