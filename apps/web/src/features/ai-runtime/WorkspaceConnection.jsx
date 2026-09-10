import {useEffect,useState} from 'react';
import {workspaceApi} from './workspaceApi.js';
export default function WorkspaceConnection(){
  const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let stopped=false;workspaceApi('status').then(value=>{if(!stopped)setState(value);}).catch(e=>{if(!stopped)setError(e.message);});return()=>{stopped=true;};},[]);
  async function run(action){if(busy)return;setBusy(true);setError('');try{setState(await workspaceApi(action));}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section className="orbitWorkspaceConnection"><h3>로컬 폴더 접근</h3><p>{state?.connected?`연결됨 · ${state.name || '선택한 폴더'}`:'Codex가 사용할 폴더를 선택해주세요.'}</p><p className="orbitChatHint">선택한 폴더와 모든 하위 폴더에서 파일 읽기·생성·수정이 가능해요. 요청한 작업에 필요한 파일 내용이 AI에 전달됩니다. 삭제·중요 파일 수정은 휴대폰에서 확인해요.</p><div><button type="button" disabled={busy} onClick={()=>run('pick')}>{state?.connected?'폴더 변경':'폴더 선택 · 접근 허용'}</button>{state?.connected?<button type="button" disabled={busy} onClick={()=>run('clear')}>연결 해제</button>:null}</div><small>파일 목록은 나누어 읽고, 큰 파일도 부분 읽기가 가능해요. 생성·수정은 파일당 1MB까지 지원해요.</small>{error?<p role="alert">{error}</p>:null}</section>;
}
