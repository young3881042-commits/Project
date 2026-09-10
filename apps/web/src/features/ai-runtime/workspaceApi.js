export function workspaceApi(action, target = window) {
  if (!['status','pick','clear'].includes(action)) return Promise.reject(new Error('지원하지 않는 폴더 요청이에요.'));
  if (!target.AiAssistantNative?.requestWorkspaceAction) return Promise.reject(new Error('로컬 폴더 연결은 최신 Android 앱에서 사용할 수 있어요.'));
  return new Promise((resolve,reject)=>{
    const id=target.crypto.randomUUID();
    const cleanup=()=>{clearTimeout(timer);target.removeEventListener('orbit:workspace-result',receive);};
    const receive=event=>{if(event.detail?.requestId!==id)return;cleanup();if(event.detail.error)reject(new Error(event.detail.error));else resolve(event.detail);};
    const timer=setTimeout(()=>{cleanup();reject(new Error('폴더 연결을 다시 확인해주세요.'));},action==='pick'?300000:10000);
    target.addEventListener('orbit:workspace-result',receive);
    try{target.AiAssistantNative.requestWorkspaceAction(id,action);}catch{cleanup();reject(new Error('폴더 연결을 시작하지 못했어요.'));}
  });
}
