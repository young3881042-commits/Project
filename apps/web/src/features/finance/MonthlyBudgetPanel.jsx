import { useEffect, useState } from 'react';
import { formatNumber } from '../../utils/lifeHubFormatters.js';

export default function MonthlyBudgetPanel({ amount = 0, usage = null, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(amount ? String(amount) : '');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDraft(amount ? String(amount) : '');
  }, [amount]);

  const submit = (event) => {
    event.preventDefault();
    const nextAmount = Math.round(Math.max(0, Number(draft) || 0));
    if (!nextAmount) {
      setMessage('월 예산을 1원 이상 입력해주세요.');
      return;
    }
    const result = onSave?.(nextAmount);
    if (result?.saved === false) {
      setMessage('월 예산을 저장하지 못했어요.');
      return;
    }
    setMessage('월 예산을 저장했어요.');
    setEditing(false);
  };

  return (
    <div className="lifeHubMonthlyBudgetPanel" aria-labelledby="lifehub-monthly-budget-title">
      <header>
        <div>
          <span id="lifehub-monthly-budget-title">월 예산</span>
          <strong>{amount && Number.isFinite(usage) ? usage + '% 사용' : '아직 설정하지 않았어요'}</strong>
          {amount ? <small>설정 금액 {formatNumber(amount)}원</small> : null}
        </div>
        {!editing ? <button type="button" onClick={() => { setEditing(true); setMessage(''); }}>{amount ? '변경' : '설정'}</button> : null}
      </header>

      {editing ? (
        <form onSubmit={submit}>
          <label>
            <span>월 예산 금액</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="999999999999"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="예: 1500000"
              autoFocus={!amount}
            />
          </label>
          <div>
            <button type="submit" className="primary">예산 저장</button>
            <button type="button" onClick={() => { setEditing(false); setDraft(amount ? String(amount) : ''); setMessage(''); }}>취소</button>
          </div>
        </form>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
