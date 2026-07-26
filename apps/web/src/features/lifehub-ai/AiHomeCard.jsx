import { useEffect, useState } from 'react';
import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import useBridgeConnection from './useBridgeConnection.js';
import { cacheProjects, projectNameFor, selectProject, selectedProjectId } from './bridgeStorage.js';

export default function AiHomeCard({ navigate }) {
  const { pc, client, status } = useBridgeConnection({ poll: false });
  const projectId = pc ? selectedProjectId(pc.id) : '';
  const [projectName, setProjectName] = useState(() => (pc ? projectNameFor(pc.id, projectId) : ''));
  const connected = status.kind === 'connected';

  useEffect(() => {
    if (!pc || !projectId) {
      setProjectName('');
      return undefined;
    }
    const cachedName = projectNameFor(pc.id, projectId);
    setProjectName(cachedName);
    if (!connected || !client) return undefined;
    let active = true;
    client.projects().then((payload) => {
      if (!active) return;
      const projects = Array.isArray(payload?.projects)
        ? payload.projects
        : Array.isArray(payload?.data?.projects) ? payload.data.projects : [];
      cacheProjects(pc.id, projects);
      const matched = projects.find((project) => String(project?.id) === projectId);
      if (!matched) selectProject(pc.id, '');
      setProjectName(matched?.name || '선택 안 됨');
    }).catch(() => {});
    return () => { active = false; };
  }, [client, connected, pc?.id, projectId]);

  return (
    <section className="lifeHubAiHomeCard" aria-labelledby="lifehub-ai-card-title">
      <div className="lifeHubAiHomeIcon"><MemoNavIcon type="message" /></div>
      <div className="lifeHubAiHomeCopy">
        <span>로컬 Codex 연동</span>
        <h2 id="lifehub-ai-card-title">AI Assistant</h2>
        <p>Codex 로그인 정보는 PC에만 두고, 승인된 Bridge를 통해 대화합니다.</p>
      </div>
      <dl className="lifeHubAiHomeStatus">
        <div>
          <dt>연결 상태</dt>
          <dd><span className={`lifeHubConnectionDot ${status.kind}`} />{status.label}</dd>
        </div>
        <div>
          <dt>연결된 PC</dt>
          <dd>{status.pcName || pc?.name || '연결된 PC 없음'}</dd>
        </div>
        <div>
          <dt>현재 프로젝트</dt>
          <dd>{projectId ? projectName || '프로젝트 확인 중' : '선택 안 됨'}</dd>
        </div>
      </dl>
      <div className="lifeHubAiHomeActions">
        {connected ? (
          <button type="button" className="primary" onClick={() => navigate('/ai')}>
            <MemoNavIcon type="message" />
            AI와 대화하기
          </button>
        ) : (
          <button type="button" className="primary" onClick={() => navigate('/ai/settings')}>
            <MemoNavIcon type="link" />
            PC 연결하기
          </button>
        )}
        {pc ? <button type="button" onClick={() => navigate('/ai/settings')}>연결 설정</button> : null}
      </div>
    </section>
  );
}
