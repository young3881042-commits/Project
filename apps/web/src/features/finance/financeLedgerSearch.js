function searchText(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR').trim();
}

export function filterFinanceLedger(entries, { query = '', type = 'all' } = {}) {
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    if (!entry || (type !== 'all' && entry.type !== type)) return false;
    const text = searchText([entry.category, entry.memo, entry.date].join(' '));
    return terms.every((term) => {
      if (text.includes(term)) return true;
      const amount = term.replace(/,/g, '').replace(/원$/, '');
      return /^\d+$/.test(amount) && Number(amount) === Number(entry.amount);
    });
  });
}
