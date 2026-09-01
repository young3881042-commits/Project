import { useEffect, useState } from 'react';
import { formatNumber } from '../../utils/lifeHubFormatters.js';
import { monthlyBudgetProgress } from './monthlyBudget.js';

export default function MonthlyBudgetPanel({ amount = 0, expense = 0, onSave }) {
  const [editing, setEditing] = useState(!amount);
  const [draft, setDraft] = useState(amount ? String(amount) : '');
  const [message, setMessage] = useState('');
  const progress = monthlyBudgetProgress(expense, amount);

  useEffect(() => {
    setDraft(amount ? String(amount) : '');
    if (!amount) setEditing(true);
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
    <section className="lifeHubMonthlyBudgetPanel" aria-labelledby="lifehub-monthly-budget-title">
      <header>
        <div>
          <span>이번 달 기준</span>
          <strong id="lifehub-monthly-budget-title">월 예산</strong>
        </div>
        {amount && !editing ? <button type="button" onClick={() => setEditing(true)}>변경</button> : null}
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
            {amount ? <button type="button" onClick={() => { setEditing(false); setDraft(String(amount)); setMessage(''); }}>취소</button> : null}
          </div>
        </form>
      ) : (
        <div className="lifeHubMonthlyBudgetProgress">
          <div>
            <span>예산 {formatNumber(amount)}원</span>
            <strong>{progress.exceeded ? formatNumber(progress.exceeded) + '원 초과' : formatNumber(progress.remaining) + '원 남음'}</strong>
          </div>
          <div role="progressbar" aria-label="월 예산 사용률" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(100, progress.usage)}>
            <span style={{ width: String(Math.min(100, progress.usage)) + '%' }} />
          </div>
          <small>현재 {formatNumber(expense)}원 · 예산의 {progress.usage}%</small>
        </div>
      )}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
