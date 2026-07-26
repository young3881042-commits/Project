import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { promisify } from "node:util";
import {
  executeRemoteCommand,
  prepareRemoteCommand,
  RemoteCommandError,
} from "../src/remote-command.js";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const HTTPS_HOST = "git.example.test";
const SSH_HOST = "ssh.git.example.test";
const HTTPS_REMOTE_URL = `https://${HTTPS_HOST}/lifehub/project.git`;
const SSH_REMOTE_URL = `ssh://git@${SSH_HOST}/lifehub/project.git`;

afterEach(async () => {
  while (temporaryRoots.length) {
    await rm(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

async function runGit(cwd: string, ...args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
    },
  });
  return String(result.stdout || "").trim();
}

interface GitFixture {
  root: string;
  bare: string;
  head: string;
  allowedHosts: Set<string>;
}

async function gitFixture(): Promise<GitFixture> {
  const temporary = await mkdtemp(join(tmpdir(), "lifehub-remote-command-"));
  temporaryRoots.push(temporary);
  const root = join(temporary, "project");
  const bare = join(temporary, "remote.git");
  await mkdir(root);
  await runGit(root, "init", "--quiet", "--initial-branch=main");
  await runGit(root, "config", "user.name", "LifeHub Test");
  await runGit(root, "config", "user.email", "lifehub-test@example.invalid");
  await writeFile(join(root, "README.md"), "# remote command fixture\n", "utf8");
  await runGit(root, "add", "README.md");
  await runGit(root, "commit", "--quiet", "-m", "initial");

  await runGit(temporary, "init", "--quiet", "--bare", bare);
  await runGit(root, "remote", "add", "origin", bare);
  await runGit(root, "remote", "set-url", "--push", "origin", HTTPS_REMOTE_URL);
  await runGit(root, "remote", "add", "ssh-origin", bare);
  await runGit(root, "remote", "set-url", "--push", "ssh-origin", SSH_REMOTE_URL);
  await runGit(root, "config", "branch.main.remote", "origin");
  await runGit(root, "config", "branch.main.merge", "refs/heads/main");

  return {
    root,
    bare,
    head: await runGit(root, "rev-parse", "HEAD"),
    allowedHosts: new Set([HTTPS_HOST, SSH_HOST]),
  };
}

async function rejectsWithCode(promise: Promise<unknown>, code: string, message?: string): Promise<void> {
  await assert.rejects(
    promise,
    (error: unknown) => error instanceof RemoteCommandError && error.code === code,
    message,
  );
}

test("복합 shell, 프로젝트 밖 경로, interpreter eval과 금지 실행 파일을 차단한다", async () => {
  const { root, allowedHosts } = await gitFixture();
  const outsideFile = join(root, "..", "outside-secret.txt");
  await writeFile(outsideFile, "must stay outside\n", "utf8");
  await symlink(outsideFile, join(root, "outside-link"));
  const cases = [
    ["echo first && echo second", "COMPLEX_COMMAND_NOT_ALLOWED"],
    ["echo first | cat", "COMPLEX_COMMAND_NOT_ALLOWED"],
    ["echo value > output.txt", "COMPLEX_COMMAND_NOT_ALLOWED"],
    ["echo $(id)", "COMPLEX_COMMAND_NOT_ALLOWED"],
    ["cat /etc/passwd", "PATH_OUTSIDE_PROJECT"],
    ["cat ../outside.txt", "PATH_OUTSIDE_PROJECT"],
    ["cat outside-link", "PATH_OUTSIDE_PROJECT"],
    ["cat src/*.ts", "PATH_OUTSIDE_PROJECT"],
    ["node -e 'process.stdout.write(\"unsafe\")'", "INTERPRETER_EVAL_NOT_ALLOWED"],
    ["node --eval='process.stdout.write(\"unsafe\")'", "INTERPRETER_EVAL_NOT_ALLOWED"],
    ["node -p'1+1'", "INTERPRETER_EVAL_NOT_ALLOWED"],
    ["python3 -c 'print(1)'", "INTERPRETER_EVAL_NOT_ALLOWED"],
    ["python3 -c'print(1)'", "INTERPRETER_EVAL_NOT_ALLOWED"],
    ["python3 -m http.server", "INTERPRETER_EVAL_NOT_ALLOWED"],
    ["perl -E'say 1'", "INTERPRETER_EVAL_NOT_ALLOWED"],
    ["php -r'echo 1'", "INTERPRETER_EVAL_NOT_ALLOWED"],
    ["ruby -e'puts 1'", "INTERPRETER_EVAL_NOT_ALLOWED"],
    ["rg --pre 'cat /etc/passwd' root README.md", "RG_EXTERNAL_COMMAND_NOT_ALLOWED"],
    ["rg --hostname-bin cat README.md", "RG_EXTERNAL_COMMAND_NOT_ALLOWED"],
    ["grep -f/etc/passwd README.md", "PATH_OUTSIDE_PROJECT"],
    ["grep -foutside-link README.md", "PATH_OUTSIDE_PROJECT"],
    ["bash -lc pwd", "EXECUTABLE_NOT_ALLOWED"],
    ["curl https://example.invalid", "EXECUTABLE_NOT_ALLOWED"],
    ["/tmp/untrusted-tool --version", "EXECUTABLE_NOT_ALLOWED"],
  ] as const;

  for (const [command, code] of cases) {
    await rejectsWithCode(
      prepareRemoteCommand(root, command, allowedHosts),
      code,
      `${command} should fail with ${code}`,
    );
  }
});

test("단순 조회와 빌드 명령을 분류하고 shell 없이 프로젝트 루트에서 실행한다", async () => {
  const { root, allowedHosts } = await gitFixture();
  const readPlan = await prepareRemoteCommand(root, "git status --short", allowedHosts);
  assert.equal(readPlan.permission, "git");
  assert.deepEqual(readPlan.argv, ["git", "status", "--short"]);
  const readResult = await executeRemoteCommand(root, readPlan);
  assert.equal(readResult.exitCode, 0);
  assert.equal(readResult.timedOut, false);
  assert.equal(readResult.stderr, "");

  const commandPlan = await prepareRemoteCommand(root, "ls -1", allowedHosts);
  assert.equal(commandPlan.permission, "command:execute");
  assert.equal(commandPlan.risk, "high");
  const commandResult = await executeRemoteCommand(root, commandPlan);
  assert.equal(commandResult.exitCode, 0);
  assert.match(commandResult.stdout, /README\.md/);

  const buildPlan = await prepareRemoteCommand(root, "npm --version", allowedHosts);
  assert.equal(buildPlan.permission, "build:execute");
  assert.equal(buildPlan.risk, "medium");
  const buildResult = await executeRemoteCommand(root, buildPlan);
  assert.equal(buildResult.exitCode, 0);
  assert.match(buildResult.stdout, /^\d+\.\d+/);
});

test("stdout과 stderr를 각각 제한하고 장기 실행 명령 취소를 전달한다", async () => {
  const { root, allowedHosts } = await gitFixture();
  await writeFile(
    join(root, "large-output.mjs"),
    "process.stdout.write('o'.repeat(160 * 1024));\nprocess.stderr.write('e'.repeat(160 * 1024));\n",
    "utf8",
  );
  const outputPlan = await prepareRemoteCommand(root, "node large-output.mjs", allowedHosts);
  const output = await executeRemoteCommand(root, outputPlan);
  assert.equal(output.exitCode, 0);
  assert.match(output.stdout, /\[출력이 제한 크기를 넘어 잘렸습니다\.\]/);
  assert.match(output.stderr, /\[오류 출력이 제한 크기를 넘어 잘렸습니다\.\]/);
  assert.ok(Buffer.byteLength(output.stdout) < 132 * 1024);
  assert.ok(Buffer.byteLength(output.stderr) < 132 * 1024);

  await writeFile(
    join(root, "wait.mjs"),
    [
      "import { writeFileSync } from 'node:fs';",
      "process.on('SIGTERM', () => writeFileSync('sigterm-seen', 'yes'));",
      "writeFileSync('wait-ready', 'yes');",
      "setInterval(() => {}, 1_000);",
      "",
    ].join("\n"),
    "utf8",
  );
  const waitPlan = await prepareRemoteCommand(root, "node wait.mjs", allowedHosts);
  const controller = new AbortController();
  const execution = executeRemoteCommand(root, waitPlan, controller.signal);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await access(join(root, "wait-ready"));
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  await access(join(root, "wait-ready"));
  const abortedAt = Date.now();
  controller.abort();
  await rejectsWithCode(execution, "REMOTE_COMMAND_CANCELLED");
  assert.ok(Date.now() - abortedAt < 3_000, "SIGTERM을 무시해도 강제 종료되어야 한다");
  await access(join(root, "sigterm-seen"));
});

test("승인 뒤 파일이 외부 symlink로 바뀌면 실행 직전에 차단한다", async () => {
  const { root, allowedHosts } = await gitFixture();
  const approvedPath = join(root, "approved.txt");
  const outsidePath = join(root, "..", "outside-after-approval.txt");
  await writeFile(approvedPath, "safe before approval\n", "utf8");
  await writeFile(outsidePath, "must stay outside\n", "utf8");
  const plan = await prepareRemoteCommand(root, "cat approved.txt", allowedHosts);
  await rm(approvedPath);
  await symlink(outsidePath, approvedPath);

  await rejectsWithCode(executeRemoteCommand(root, plan), "PATH_OUTSIDE_PROJECT");
});

test("이미 취소된 요청은 side effect 프로세스를 시작하지 않는다", async () => {
  const { root, allowedHosts } = await gitFixture();
  const plan = await prepareRemoteCommand(root, "touch must-not-exist.txt", allowedHosts);
  const controller = new AbortController();
  controller.abort();

  await rejectsWithCode(executeRemoteCommand(root, plan, controller.signal), "REMOTE_COMMAND_CANCELLED");
  await assert.rejects(access(join(root, "must-not-exist.txt")));
});

test("Git 허용 subcommand만 계획하고 저장소 override와 hook 우회를 차단한다", async () => {
  const { root, allowedHosts } = await gitFixture();
  const commands = [
    "git add README.md",
    "git commit -m test",
    "git diff --no-ext-diff",
    "git log -1",
    "git ls-files",
    "git rev-parse HEAD",
    "git show HEAD",
    "git status --short",
  ];
  for (const command of commands) {
    const plan = await prepareRemoteCommand(root, command, allowedHosts);
    assert.equal(plan.permission, "git", command);
    assert.equal(plan.risk, "high", command);
    assert.equal(plan.gitPush, undefined, command);
  }

  for (const command of ["git clone example", "git clean -fd", "git reset --hard", "git checkout other"]) {
    await rejectsWithCode(prepareRemoteCommand(root, command, allowedHosts), "GIT_COMMAND_NOT_ALLOWED", command);
  }
  for (const command of [
    "git -C nested status",
    "git -c core.pager=cat status",
    "git --git-dir=.git status",
    "git --work-tree=. status",
  ]) {
    await rejectsWithCode(prepareRemoteCommand(root, command, allowedHosts), "GIT_REPOSITORY_OVERRIDE_DENIED", command);
  }
  await rejectsWithCode(
    prepareRemoteCommand(root, "git commit --no-verify -m bypass", allowedHosts),
    "GIT_HOOK_BYPASS_DENIED",
  );
});

test("현재 branch와 HEAD에 고정된 HTTPS/SSH git push 계획만 만든다", async () => {
  const fixture = await gitFixture();
  assert.equal(await runGit(fixture.bare, "rev-parse", "--is-bare-repository"), "true");

  const httpsPlan = await prepareRemoteCommand(
    fixture.root,
    "git push --set-upstream origin main",
    fixture.allowedHosts,
  );
  assert.equal(httpsPlan.permission, "git");
  assert.deepEqual(httpsPlan.argv, ["git", "push", "--set-upstream", "origin", "main"]);
  assert.deepEqual(httpsPlan.gitPush, {
    remote: "origin",
    branch: "main",
    head: fixture.head,
    host: HTTPS_HOST,
    remoteUrl: HTTPS_REMOTE_URL,
    setUpstream: true,
  });

  const sshPlan = await prepareRemoteCommand(fixture.root, "git push ssh-origin main", fixture.allowedHosts);
  assert.deepEqual(sshPlan.argv, ["git", "push", "ssh-origin", "main"]);
  assert.deepEqual(sshPlan.gitPush, {
    remote: "ssh-origin",
    branch: "main",
    head: fixture.head,
    host: SSH_HOST,
    remoteUrl: SSH_REMOTE_URL,
    setUpstream: false,
  });

  const defaultPlan = await prepareRemoteCommand(fixture.root, "git push", fixture.allowedHosts);
  assert.deepEqual(defaultPlan.argv, ["git", "push", "origin", "main"]);
  assert.equal(defaultPlan.gitPush?.remote, "origin");
  assert.equal(defaultPlan.gitPush?.branch, "main");
});

test("force, refspec, 다른 branch, 직접 URL과 비허용 host push를 차단한다", async () => {
  const { root, allowedHosts } = await gitFixture();
  for (const command of ["git push --force origin main", "git push -f origin main", "git push --all"]) {
    await rejectsWithCode(prepareRemoteCommand(root, command, allowedHosts), "GIT_PUSH_OPTIONS_DENIED", command);
  }
  for (const command of [
    "git push origin other",
    "git push origin HEAD",
    "git push origin main:main",
    "git push origin +main",
  ]) {
    await rejectsWithCode(prepareRemoteCommand(root, command, allowedHosts), "GIT_PUSH_BRANCH_DENIED", command);
  }
  await rejectsWithCode(
    prepareRemoteCommand(root, `git push ${HTTPS_REMOTE_URL} main`, allowedHosts),
    "GIT_PUSH_REMOTE_DENIED",
  );
  await rejectsWithCode(
    prepareRemoteCommand(root, "git push origin main", new Set(["another.example.test"])),
    "GIT_PUSH_HOST_DENIED",
  );

  await runGit(root, "remote", "set-url", "--push", "origin", join(root, "local-only.git"));
  await rejectsWithCode(
    prepareRemoteCommand(root, "git push origin main", allowedHosts),
    "GIT_REMOTE_NOT_ALLOWED",
  );
});

test("승인 뒤 HEAD가 바뀌면 실제 push 전에 실행을 차단한다", async () => {
  const { root, allowedHosts } = await gitFixture();
  const plan = await prepareRemoteCommand(root, "git push origin main", allowedHosts);
  await writeFile(join(root, "after-approval.txt"), "changed after approval\n", "utf8");
  await runGit(root, "add", "after-approval.txt");
  await runGit(root, "commit", "--quiet", "-m", "change head after approval");

  await rejectsWithCode(executeRemoteCommand(root, plan), "GIT_PUSH_STATE_CHANGED");
});

test("승인 뒤 push remote가 바뀌면 실제 push 전에 실행을 차단한다", async () => {
  const { root, allowedHosts } = await gitFixture();
  const plan = await prepareRemoteCommand(root, "git push origin main", allowedHosts);
  await runGit(root, "remote", "set-url", "--push", "origin", "https://changed.example.test/lifehub/project.git");

  await rejectsWithCode(executeRemoteCommand(root, plan), "GIT_PUSH_STATE_CHANGED");
});
