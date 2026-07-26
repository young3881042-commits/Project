import MemoNavIcon from '../../components/MemoNavIcon.jsx';

export default function PairedPcList({ pcs, selected, choosePc, revoke, revokingId }) {
  return (
    <section className="lifeHubAiPairedList" aria-labelledby="paired-pcs-title">
      <header><div><span>내 연결</span><h3 id="paired-pcs-title">연결된 Orbit</h3></div><strong>{pcs.length}대</strong></header>
      {pcs.length ? pcs.map((pc) => (
        <article key={pc.id} className={selected?.id === pc.id ? 'selected' : ''}>
          <button type="button" className="lifeHubAiPcSelect" aria-pressed={selected?.id === pc.id} onClick={() => choosePc(pc.id)}>
            <MemoNavIcon type="briefcase" />
            <span><strong>{pc.name}</strong><small>{pc.baseUrl}</small></span>
            {selected?.id === pc.id ? <em>사용 중</em> : <em>선택</em>}
          </button>
          <button type="button" className="lifeHubAiRevoke" aria-label={`${pc.name} 연결 해제`} disabled={revokingId === pc.id} onClick={() => revoke(pc)}>
            {revokingId === pc.id ? '폐기 중' : '페어링 해제'}
          </button>
        </article>
      )) : (
        <div className="lifeHubAiEmptyCompact"><MemoNavIcon type="link" /><strong>아직 연결된 기기가 없어요</strong><p>이 PC에서는 로컬 연결 버튼을 한 번 누르면 됩니다.</p></div>
      )}
    </section>
  );
}
