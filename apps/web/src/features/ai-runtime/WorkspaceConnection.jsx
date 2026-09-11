import {useEffect,useState} from 'react';
import {workspaceApi} from './workspaceApi.js';
export default function WorkspaceConnection(){
  const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let stopped=false;workspaceApi('status').then(value=>{if(!stopped)setState(value);}).catch(e=>{if(!stopped)setError(e.message);});return()=>{stopped=true;};},[]);
  async function run(action){if(busy)return;setBusy(true);setError('');try{setState(await workspaceApi(action));}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section className="orbitWorkspaceConnection"><h3>Orbit 작업공간</h3><p>{state?.connected?'사용 가능 · 기본 작업공간':'작업공간 확인 중…'}</p><p className="orbitChatHint">별도 폴더 권한 없이 AI가 파일을 읽고 만들고 수정해요. 여행 이미지는 travel 폴더에 저장돼요. 앱 삭제 시 함께 지워지므로 필요한 이미지는 파일로 내보내주세요.</p>{state?.externalConnected?<p>외부 폴더 · {state.externalName} (external)</p>:null}<div><button type="button" disabled={busy} onClick={()=>run('pick')}>{state?.externalConnected?'외부 폴더 변경':'외부 폴더 추가'}</button>{state?.externalConnected?<button type="button" disabled={busy} onClick={()=>run('clear')}>외부 폴더 해제</button>:null}</div><small>추가한 외부 폴더도 모든 하위 폴더를 사용할 수 있어요. 요청한 작업에 필요한 파일 내용이 AI에 전달됩니다.</small>{error?<p role="alert">{error}</p>:null}</section>;
}
