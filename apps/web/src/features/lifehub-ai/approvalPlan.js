const COMMAND_PERMISSIONS = new Set(['command:execute', 'build:execute', 'git']);

export function approvalPlanLines(value, limit) {
  return [...new Set(String(value || '').split('\n').map((line) => line.trim()).filter(Boolean))].slice(0, limit);
}

export function unsafeProjectRelativePath(path) {
  const value = String(path || '').trim();
  return !value
    || value.startsWith('/')
    || value.startsWith('~')
    || /^[a-z]:[\\/]/i.test(value)
    || value.split(/[\\/]+/).includes('..');
}

export function createApprovalPlan({ requestedPermissions, filesText, commandsText, description }) {
  const permissions = Array.isArray(requestedPermissions) ? requestedPermissions : [];
  const mutatingPermissions = permissions.filter((permission) => permission !== 'project:read');
  const files = approvalPlanLines(filesText, 100);
  const commands = approvalPlanLines(commandsText, 20);

  if (mutatingPermissions.includes('file:write')) {
    if (!files.length) {
      return { error: '파일 수정 권한을 요청하려면 변경 예정 파일을 프로젝트 상대 경로로 입력해주세요.' };
    }
    if (files.some(unsafeProjectRelativePath)) {
      return { error: '변경 예정 파일에는 프로젝트 상대 경로만 사용할 수 있으며 ../, 절대 경로, ~ 경로는 허용되지 않습니다.' };
    }
  }
  if (mutatingPermissions.some((permission) => COMMAND_PERMISSIONS.has(permission)) && !commands.length) {
    return { error: '명령·빌드·Git 권한을 요청하려면 실행 예정 명령을 한 줄에 하나씩 입력해주세요.' };
  }
  return {
    error: '',
    mutatingPermissions,
    context: mutatingPermissions.length ? {
      description: String(description || '').slice(0, 500),
      files,
      commands
    } : undefined
  };
}
