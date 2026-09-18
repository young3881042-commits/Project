import { MERCHANT_CATALOG, MERCHANT_CATALOG_DATE } from './merchantCatalog.js';
import { useState } from 'react';
import {
  DEFAULT_FINANCE_CATEGORIES,
  addFinanceCategory,
  keywordsForFinanceCategory,
  managedFinanceCategories,
  removeFinanceCategory,
  removeFinanceCategoryKeyword
} from './financeCategories.js';

function savedMessage(result, fallback) {
  if (result?.applied === false) return `${fallback} 새 자동 가져오기에는 적용되지만 기존 기록은 저장하지 못했어요.`;
  if (result?.recategorized > 0) return `${fallback} 기존 자동 가져오기 ${result.recategorized}건에도 적용했어요.`;
  return fallback;
}

export default function FinanceCategorySettingsPanel({ settings, onSave }) {
  const [draft, setDraft] = useState({ category: '', keywords: '' });
  const [message, setMessage] = useState('');
  const categories = managedFinanceCategories(settings);

  const save = (next, successMessage) => {
    const result = onSave?.(next);
    if (result === false || result?.saved === false) {
      setMessage('분류 설정을 저장하지 못했어요. 저장공간을 확인해주세요.');
      return false;
    }
    setMessage(savedMessage(result, successMessage));
    return true;
  };

  const submit = (event) => {
    event.preventDefault();
    const result = addFinanceCategory(settings, draft);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    if (!result.changed) {
      setMessage('이미 같은 분류와 키워드가 있어요.');
      return;
    }
    const categoryLabel = draft.category.trim();
    if (!save(result.settings, `${categoryLabel} 분류를 저장했어요.`)) return;
    setDraft({ category: '', keywords: '' });
  };

  const removeCategory = (category) => {
    const result = removeFinanceCategory(settings, category);
    if (!result.changed) return;
    save(result.settings, `${category} 분류를 삭제했어요.`);
  };

  const removeKeyword = (category, keyword) => {
    const result = removeFinanceCategoryKeyword(settings, category, keyword);
    if (!result.changed) return;
    save(result.settings, `${keyword} 키워드를 삭제했어요.`);
  };

  return (
    <section className="lifeHubFinanceCategories" aria-labelledby="financeCategorySettingsTitle">
      <header>
        <div>
          <strong id="financeCategorySettingsTitle">분류 관리</strong>
          <p>새 분류는 직접 입력과 정기 결제에서 바로 고를 수 있어요. 키워드를 넣으면 결제 알림 자동 가져오기에도 적용합니다.</p>
        </div>
      </header>
      <details className="financeMerchantCatalog">
        <summary>기본 사용처 자료 {MERCHANT_CATALOG.length}개 · {MERCHANT_CATALOG_DATE} 확인</summary>
        <p>기존 거래 분류와 직접 만든 키워드를 먼저 사용해요. 아래 분류는 업체 업종 기준이며 구입 품목을 확인한 결과는 아니에요. 편의점·슈퍼는 쇼핑으로 제안해요.</p>
        <ul>{MERCHANT_CATALOG.map(brand => <li key={brand.name}><a href={brand.source} target="_blank" rel="noopener noreferrer">{brand.name}</a> · {brand.category}</li>)}</ul>
      </details>

      <p className="lifeHubFinanceCategoryGuide">기본 자동 분류: 코레일·티머니는 교통, ‘커피’가 들어가면 커피, 다이소와 그 밖의 사용처는 기타예요.</p>
      <form onSubmit={submit}>
        <label>
          <span>새 분류 이름</span>
          <input
            value={draft.category}
            maxLength={30}
            onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
            placeholder="예: 구독, 의료"
          />
        </label>
        <label>
          <span>자동 분류 키워드 <small>선택 · 쉼표로 여러 개</small></span>
          <input
            value={draft.keywords}
            maxLength={240}
            onChange={(event) => setDraft((current) => ({ ...current, keywords: event.target.value }))}
            placeholder="예: 넷플릭스, 유튜브"
          />
        </label>
        <button type="submit">분류 추가</button>
      </form>
      {categories.length ? (
        <div className="lifeHubFinanceCategoryList" aria-label="관리하는 분류">
          {categories.map((category) => {
            const keywords = keywordsForFinanceCategory(settings, category);
            const isDefault = DEFAULT_FINANCE_CATEGORIES.includes(category);
            return (
              <article key={category}>
                <div>
                  <strong>{category}</strong>
                  {keywords.length ? (
                    <span>
                      {keywords.map((keyword) => (
                        <button
                          type="button"
                          key={`${category}-${keyword}`}
                          onClick={() => removeKeyword(category, keyword)}
                          aria-label={`${keyword} 키워드 삭제`}
                        >
                          {keyword} ×
                        </button>
                      ))}
                    </span>
                  ) : <small>자동 분류 키워드 없음</small>}
                </div>
                {!isDefault ? (
                  <button type="button" className="delete" onClick={() => removeCategory(category)} aria-label={`${category} 분류 삭제`}>삭제</button>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
      {message ? <p className="lifeHubFinanceCategoryMessage" role="status" aria-live="polite">{message}</p> : null}
    </section>
  );
}
