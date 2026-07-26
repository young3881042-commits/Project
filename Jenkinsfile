pipeline {
  agent any

  parameters {
    choice(name: 'DEPLOY_SOURCE', choices: ['local-codex', 'git'], description: 'local-codex는 현재 서버의 Codex 작업본, git은 Jenkins 전용 checkout으로 배포')
    string(name: 'GIT_BRANCH', defaultValue: 'main', description: 'DEPLOY_SOURCE=git일 때 배포할 브랜치')
    string(name: 'GIT_REMOTE', defaultValue: 'git@github.com:young3881042-commits/Project.git', description: 'DEPLOY_SOURCE=git일 때 사용할 Git remote')
  }

  options {
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timeout(time: 45, unit: 'MINUTES')
    timestamps()
  }

  environment {
    APP_REPO = '/workspace/ai-assistant'
    DOCKER_BUILDKIT = '1'
    COMPOSE_PROJECT_NAME = 'aiassistant'
    DB_PORT = '13306'
    API_PORT = '18080'
    WEB_HTTP_PORT = '80'
    WEB_HTTPS_PORT = '443'
  }

  stages {
    stage('Build and deploy') {
      steps {
        sh 'DEPLOY_SOURCE="$DEPLOY_SOURCE" GIT_REMOTE="$GIT_REMOTE" GIT_BRANCH="$GIT_BRANCH" bash "$APP_REPO/scripts/jenkins-ai-assistant-pipeline.sh"'
      }
    }
  }

  post {
    always {
      sh 'docker compose -f "$APP_REPO/docker-compose.dev.yml" ps || true'
    }
  }
}
