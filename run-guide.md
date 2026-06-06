# ai-assistant 실행 방법

이 프로젝트는 Docker 기준으로 실행합니다.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
docker compose -f docker-compose.dev.yml up -d --build
```

포트 충돌을 피해야 하면 다음처럼 지정합니다.

```bash
DB_PORT=13306 API_PORT=18080 WEB_HTTP_PORT=80 WEB_HTTPS_PORT=443 \
docker compose -f docker-compose.dev.yml up -d --build
```

확인:

```bash
docker compose -f docker-compose.dev.yml ps
curl -I http://127.0.0.1/app
curl -I http://127.0.0.1/notes
curl -I http://127.0.0.1/scheduler
curl -I http://127.0.0.1/api/destinations?size=1
```

Jenkins 배포는 `Jenkinsfile`과 `scripts/jenkins-ai-assistant-pipeline.sh`를 사용합니다.

```bash
cp .jenkins.env.example .jenkins.env
docker compose -f docker-compose.jenkins.yml up -d --build
```
