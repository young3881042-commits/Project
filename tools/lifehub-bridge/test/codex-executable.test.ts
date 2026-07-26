import assert from "node:assert/strict";
import { chmod, link, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join } from "node:path";
import { afterEach, test } from "node:test";

const resolver = await import("../bin/codex-executable.mjs") as {
  CODEX_EXECUTABLE_UNAVAILABLE_MESSAGE: string;
  resolveCodexCommand(): { command: string; argsPrefix: readonly string[]; source: string };
  resolveCodexCommandForTest(options: {
    platform: string;
    arch: string;
    pathValue: string;
    pathDelimiter?: string;
    resolveModule(specifier: string): string;
    execPath: string;
    wrapperPaths: string[];
  }): { command: string; argsPrefix: readonly string[]; source: string };
};

const temporaryRoots: string[] = [];

afterEach(async () => {
  while (temporaryRoots.length) await rm(temporaryRoots.pop()!, { recursive: true, force: true });
});

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function executable(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o755 });
  await writeFile(path, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await chmod(path, 0o755);
}

function throwingResolver(): never {
  throw new Error("module missing with a private path");
}

test("지원 플랫폼에서는 실행 가능한 pinned local Codex JS를 PATH보다 우선한다", async () => {
  const root = await temporaryRoot("lifehub-codex-pinned-");
  const cli = join(root, "node_modules/@openai/codex/bin/codex.js");
  const platformPackage = join(root, "node_modules/@openai/codex-linux-arm64/package.json");
  const native = join(dirname(platformPackage), "vendor/aarch64-unknown-linux-musl/bin/codex");
  const pathCodex = join(root, "safe-bin/codex");
  await mkdir(dirname(cli), { recursive: true });
  await writeFile(cli, "// pinned launcher\n", { mode: 0o644 });
  await mkdir(dirname(platformPackage), { recursive: true });
  await writeFile(platformPackage, "{}\n", { mode: 0o644 });
  await executable(native);
  await executable(pathCodex);

  const resolved = resolver.resolveCodexCommandForTest({
    platform: "linux",
    arch: "arm64",
    pathValue: dirname(pathCodex),
    resolveModule(specifier) {
      if (specifier === "@openai/codex/bin/codex.js") return cli;
      if (specifier === "@openai/codex-linux-arm64/package.json") return platformPackage;
      return throwingResolver();
    },
    execPath: "/trusted/node",
    wrapperPaths: [],
  });

  assert.equal(resolved.source, "pinned-local");
  assert.equal(resolved.command, "/trusted/node");
  assert.deepEqual(resolved.argsPrefix, [await realpath(cli)]);
});

test("optional package가 없어도 generic package의 pinned native binary를 확인한다", async () => {
  const root = await temporaryRoot("lifehub-codex-bundled-");
  const cli = join(root, "node_modules/@openai/codex/bin/codex.js");
  const native = join(root, "node_modules/@openai/codex/vendor/x86_64-unknown-linux-musl/bin/codex");
  await mkdir(dirname(cli), { recursive: true });
  await writeFile(cli, "// pinned launcher\n", { mode: 0o644 });
  await executable(native);

  const resolved = resolver.resolveCodexCommandForTest({
    platform: "linux",
    arch: "x64",
    pathValue: "",
    resolveModule(specifier) {
      if (specifier === "@openai/codex/bin/codex.js") return cli;
      return throwingResolver();
    },
    execPath: "/trusted/node",
    wrapperPaths: [],
  });

  assert.equal(resolved.source, "pinned-local");
  assert.deepEqual(resolved.argsPrefix, [await realpath(cli)]);
});

test("해결된 optional package의 native가 깨졌다면 generic vendor를 잘못 선택하지 않는다", async () => {
  const root = await temporaryRoot("lifehub-codex-broken-optional-");
  const cli = join(root, "node_modules/@openai/codex/bin/codex.js");
  const platformPackage = join(root, "node_modules/@openai/codex-linux-arm64/package.json");
  const genericNative = join(root, "node_modules/@openai/codex/vendor/aarch64-unknown-linux-musl/bin/codex");
  const pathCodex = join(root, "safe-bin/codex");
  await mkdir(dirname(cli), { recursive: true });
  await writeFile(cli, "// pinned launcher\n", { mode: 0o644 });
  await mkdir(dirname(platformPackage), { recursive: true });
  await writeFile(platformPackage, "{}\n", { mode: 0o644 });
  await executable(genericNative);
  await executable(pathCodex);

  const resolved = resolver.resolveCodexCommandForTest({
    platform: "linux",
    arch: "arm64",
    pathValue: dirname(pathCodex),
    resolveModule(specifier) {
      if (specifier === "@openai/codex/bin/codex.js") return cli;
      if (specifier === "@openai/codex-linux-arm64/package.json") return platformPackage;
      return throwingResolver();
    },
    execPath: "/trusted/node",
    wrapperPaths: [],
  });

  assert.equal(resolved.source, "path-fallback");
  assert.equal(resolved.command, await realpath(pathCodex));
});

test("Android이거나 local native binary가 없으면 안전한 PATH Codex로 fallback한다", async (context) => {
  await context.test("android skips an otherwise valid local binary", async () => {
    const root = await temporaryRoot("lifehub-codex-android-");
    const cli = join(root, "node_modules/@openai/codex/bin/codex.js");
    const platformPackage = join(root, "node_modules/@openai/codex-linux-arm64/package.json");
    const native = join(dirname(platformPackage), "vendor/aarch64-unknown-linux-musl/bin/codex");
    const pathCodex = join(root, "safe-bin/codex");
    await mkdir(dirname(cli), { recursive: true });
    await writeFile(cli, "// unusable on Android\n", { mode: 0o755 });
    await mkdir(dirname(platformPackage), { recursive: true });
    await writeFile(platformPackage, "{}\n", { mode: 0o644 });
    await executable(native);
    await executable(pathCodex);

    const resolved = resolver.resolveCodexCommandForTest({
      platform: "android",
      arch: "arm64",
      pathValue: dirname(pathCodex),
      resolveModule(specifier) {
        if (specifier === "@openai/codex/bin/codex.js") return cli;
        if (specifier === "@openai/codex-linux-arm64/package.json") return platformPackage;
        return throwingResolver();
      },
      execPath: "/trusted/node",
      wrapperPaths: [],
    });

    assert.equal(resolved.source, "path-fallback");
    assert.equal(resolved.command, await realpath(pathCodex));
    assert.deepEqual(resolved.argsPrefix, []);
  });

  await context.test("missing native package falls back on linux", async () => {
    const root = await temporaryRoot("lifehub-codex-missing-native-");
    const cli = join(root, "node_modules/@openai/codex/bin/codex.js");
    const pathCodex = join(root, "safe-bin/codex");
    await mkdir(dirname(cli), { recursive: true });
    await writeFile(cli, "// launcher without optional dependency\n", { mode: 0o644 });
    await executable(pathCodex);

    const resolved = resolver.resolveCodexCommandForTest({
      platform: "linux",
      arch: "arm64",
      pathValue: dirname(pathCodex),
      resolveModule(specifier) {
        if (specifier === "@openai/codex/bin/codex.js") return cli;
        return throwingResolver();
      },
      execPath: "/trusted/node",
      wrapperPaths: [],
    });

    assert.equal(resolved.source, "path-fallback");
    assert.equal(resolved.command, await realpath(pathCodex));
  });
});

test("PATH fallback은 상대·node_modules/.bin·실행불가·world-writable 경로를 건너뛴다", async () => {
  const root = await temporaryRoot("lifehub-codex-path-filter-");
  const modulesBin = join(root, "node_modules/.bin");
  const modulesAlias = join(root, "modules-alias");
  const writableBin = join(root, "writable-bin");
  const nonExecutableBin = join(root, "non-executable-bin");
  const safeBin = join(root, "safe-bin");
  await executable(join(modulesBin, "codex"));
  await symlink(modulesBin, modulesAlias, "dir");
  await executable(join(writableBin, "codex"));
  await chmod(writableBin, 0o777);
  await mkdir(nonExecutableBin, { mode: 0o755 });
  await writeFile(join(nonExecutableBin, "codex"), "not executable\n", { mode: 0o644 });
  await executable(join(safeBin, "codex"));

  const resolved = resolver.resolveCodexCommandForTest({
    platform: "linux",
    arch: "arm64",
    pathValue: ["", "relative-bin", modulesBin, modulesAlias, writableBin, nonExecutableBin, safeBin].join(delimiter),
    resolveModule: throwingResolver,
    execPath: "/trusted/node",
    wrapperPaths: [],
  });

  assert.equal(resolved.command, await realpath(join(safeBin, "codex")));
});

test("PATH fallback은 wrapper와 깨진 local JS의 symlink/hardlink 재귀를 차단한다", async () => {
  const root = await temporaryRoot("lifehub-codex-recursion-");
  const wrapper = join(root, "codex-wrapper.mjs");
  const cli = join(root, "node_modules/@openai/codex/bin/codex.js");
  const wrapperBin = join(root, "wrapper-bin");
  const localBin = join(root, "local-bin");
  const safeBin = join(root, "safe-bin");
  await executable(wrapper);
  await executable(cli);
  await mkdir(wrapperBin, { mode: 0o755 });
  await link(wrapper, join(wrapperBin, "codex"));
  await mkdir(localBin, { mode: 0o755 });
  await symlink(cli, join(localBin, "codex"));
  await executable(join(safeBin, "codex"));

  const resolved = resolver.resolveCodexCommandForTest({
    platform: "android",
    arch: "arm64",
    pathValue: [wrapperBin, localBin, safeBin].join(delimiter),
    resolveModule(specifier) {
      if (specifier === "@openai/codex/bin/codex.js") return cli;
      return throwingResolver();
    },
    execPath: "/trusted/node",
    wrapperPaths: [wrapper],
  });

  assert.equal(resolved.command, await realpath(join(safeBin, "codex")));
});

test("resolver 실패는 PATH나 내부 오류를 노출하지 않는 고정 메시지만 반환한다", async () => {
  const root = await temporaryRoot("lifehub-codex-secret-path-");
  const privatePath = join(root, "private-auth-location");
  await mkdir(privatePath, { mode: 0o755 });

  assert.throws(
    () => resolver.resolveCodexCommandForTest({
      platform: "android",
      arch: "arm64",
      pathValue: privatePath,
      resolveModule: throwingResolver,
      execPath: "/trusted/node",
      wrapperPaths: [],
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, resolver.CODEX_EXECUTABLE_UNAVAILABLE_MESSAGE);
      assert.doesNotMatch(error.message, /private-auth-location|module missing/);
      return true;
    },
  );
});

test("Codex wrapper는 resume를 유지하고 사용자 config를 무시한다", async () => {
  const common = await import("../bin/codex-wrapper.mjs") as {
    hardenedCodexArgs(input: string[]): string[];
  };
  const resumed = common.hardenedCodexArgs(["exec", "--experimental-json", "resume", "thread-id"]);
  assert.deepEqual(resumed, ["exec", "--ignore-user-config", "--experimental-json", "resume", "thread-id"]);
  assert.equal(resumed.includes("--ephemeral"), false);
  assert.deepEqual(common.hardenedCodexArgs(["login", "status"]), ["login", "status"]);
});

test("공용 wrapper와 loginStatus가 같은 resolver 실행 경로를 사용한다", async () => {
  const commonSource = await import("node:fs/promises").then(({ readFile }) => readFile(join(process.cwd(), "bin/codex-wrapper.mjs"), "utf8"));
  const adapterSource = await import("node:fs/promises").then(({ readFile }) => readFile(join(process.cwd(), "src/codex-adapter.ts"), "utf8"));
  assert.match(commonSource, /resolveCodexCommand\(\)/);
  assert.match(commonSource, /shell:\s*false/);
  assert.match(adapterSource, /\[CODEX_WRAPPER_PATH, "login", "status"\]/);
  assert.doesNotMatch(adapterSource, /@openai\/codex\/bin\/codex\.js/);
});

test("현재 Android 런타임에서는 실제 PATH native Codex를 선택한다", { skip: process.platform !== "android" }, () => {
  const resolved = resolver.resolveCodexCommand();
  assert.equal(resolved.source, "path-fallback");
  assert.equal(resolved.argsPrefix.length, 0);
  assert.equal(basename(resolved.command), "codex");
});
