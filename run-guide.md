# ai-assitant 실행 방법

실행 순서: **DB → API → Web**

# 0. Docker base 배포 후 테스트
main 이미지는 `/home/lezzs5103/vibeCoding`의 `ai-assitant-*` 이미지와 `vibecoding-*` compose 컨테이너입니다.

```bash
cd /home/lezzs5103/vibeCoding
docker compose -f docker-compose.dev.yml up -d --build
scripts/smoke_test_docker_base.sh
```

배포 후에는 항상 스모크 테스트까지 실행합니다. 테스트는 실제 `http://127.0.0.1/mypage`와 배포된 JS 번들을 받아 UI 문구와 캐시 헤더를 확인합니다.

# 1. 서버 배포 순서

## 1.1 DB 실행
cd infra/db/docker
docker compose up -d

## 1.2 API 실행
cd /apps/api
cp .env.example .env
./run-local.sh

## 1.3.1 Web 실행 (Local)
cd /apps/web
cp .env.example .env
./run-local.sh

## 1.3.2  Web 실행 (Docker)
cd infra/web/docker
docker compose up --build
