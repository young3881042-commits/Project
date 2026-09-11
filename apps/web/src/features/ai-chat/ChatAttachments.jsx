export default function ChatAttachments({ files = [], onRemove }) {
  if (!files.length) return null;
  return <div className="orbitChatAttachments" aria-label={onRemove ? '보낼 첨부 파일' : '첨부 파일'}>
    {files.map((file, index) => <div className="orbitChatAttachment" key={`${file.name}:${index}`}>
      {file.kind === 'image' ? <div><img className="orbitChatPhoto" src={file.dataUrl} alt={file.name} /><small>{file.name} · 전송용 사진</small></div> : <details><summary><span aria-hidden="true">📄</span><strong>{file.name}</strong><small>{file.text.length.toLocaleString()}자{file.truncated ? ' · 일부만 포함' : ''}</small></summary><pre>{file.text}</pre></details>}
      {onRemove ? <button type="button" aria-label={`${file.name} 첨부 제거`} onClick={() => onRemove(index)}>×</button> : null}
    </div>)}
  </div>;
}
