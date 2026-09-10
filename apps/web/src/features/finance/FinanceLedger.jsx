import { useMemo, useRef, useState } from 'react';
import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import { EmptyState, Section } from '../../components/lifehub/LifeHubUi.jsx';
import { money } from '../../utils/lifeHubFormatters.js';
import { filterFinanceLedger } from './financeLedgerSearch.js';

const ENTRY_TYPES = [
  { value: 'all', label: '전체' },
  { value: 'withdraw', label: '지출' },
  { value: 'deposit', label: '수입' }
];

export default function FinanceLedger({ entries, title, eyebrow, emptyTitle, onClearCategory, onAddEntry, onEdit, onDelete, titleForEntry, metaForEntry }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [entryLimit, setEntryLimit] = useState(8);
  const searchRef = useRef(null);
  const results = useMemo(() => filterFinanceLedger(entries, { query, type }), [entries, query, type]);
  const filtering = Boolean(query.trim()) || type !== 'all';

  const resetFilters = () => {
    setQuery('');
    setType('all');
    setEntryLimit(8);
    searchRef.current?.focus();
  };

  return (
    <Section
      className="finance-ledger-section"
      title={title}
      eyebrow={eyebrow}
      action={onClearCategory ? <button type="button" className="lifeHubTextAction" onClick={onClearCategory}>전체 내역</button> : null}
    >
      <div className="lifeHubLedgerToolbar">
        <div className="lifeHubLedgerSearch">
          <MemoNavIcon type="search" />
          <input
            ref={searchRef}
            type="search"
            aria-label="거래 검색"
            aria-controls="finance-ledger-results"
            placeholder="사용처, 메모, 금액, 날짜 검색"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setEntryLimit(8); }}
          />
          {query ? (
            <button type="button" aria-label="검색어 지우기" onClick={() => { setQuery(''); setEntryLimit(8); searchRef.current?.focus(); }}>
              <MemoNavIcon type="close" />
            </button>
          ) : null}
        </div>
        <div className="lifeHubLedgerFilters" role="group" aria-label="거래 유형">
          {ENTRY_TYPES.map((item) => (
            <button
              type="button"
              key={item.value}
              aria-pressed={type === item.value}
              aria-controls="finance-ledger-results"
              onClick={() => { setType(item.value); setEntryLimit(8); }}
            >{item.label}</button>
          ))}
          <span role="status">{filtering ? '검색 결과 ' : ''}{results.length}건</span>
        </div>
      </div>
      <div className="lifeHubTransactionList" id="finance-ledger-results" aria-live="polite">
        {results.slice(0, entryLimit).map((entry) => (
          <article key={entry.id} className="finance-ledger-row">
            <span className={entry.type}>{entry.type === 'deposit' ? '수입' : '지출'}</span>
            <div>
              <strong>{titleForEntry(entry)}</strong>
              <small>{metaForEntry(entry)}</small>
            </div>
            <em className={entry.type}>{entry.type === 'deposit' ? '+' : '−'}{money(entry.amount)}</em>
            <div className="lifeHubLedgerActions">
              <button type="button" onClick={() => onEdit(entry)} aria-label={titleForEntry(entry) + ' 거래 수정'}>수정</button>
              <button type="button" className="danger" onClick={() => onDelete(entry)} aria-label={titleForEntry(entry) + ' 거래 삭제'}>삭제</button>
            </div>
          </article>
        ))}
        {results.length > entryLimit ? (
          <button type="button" className="finance-ledger-more" onClick={() => setEntryLimit((current) => current + 20)}>
            거래 더 보기 · {results.length - entryLimit}개 남음
          </button>
        ) : null}
        {results.length ? null : filtering ? (
          <EmptyState title="일치하는 거래가 없어요" text="검색어나 수입·지출 필터를 바꿔보세요." actionLabel="검색 초기화" icon="search" onAction={resetFilters} />
        ) : (
          <EmptyState title={emptyTitle} text="금액만 입력해도 이번 달 흐름에 바로 반영돼요." actionLabel="지출 기록하기" icon="chart" onAction={onAddEntry} />
        )}
      </div>
    </Section>
  );
}
