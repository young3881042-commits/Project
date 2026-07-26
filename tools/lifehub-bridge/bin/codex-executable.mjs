import { accessSync, constants, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const UNAVAILABLE_MESSAGE = "Codex executable is unavailable.";

const TARGETS = {
  linux: {
    x64: ["x86_64-unknown-linux-musl", "@openai/codex-linux-x64"],
    arm64: ["aarch64-unknown-linux-musl", "@openai/codex-linux-arm64"],
  },
  darwin: {
    x64: ["x86_64-apple-darwin", "@openai/codex-darwin-x64"],
    arm64: ["aarch64-apple-darwin", "@openai/codex-darwin-arm64"],
  },
  win32: {
    x64: ["x86_64-pc-windows-msvc", "@openai/codex-win32-x64"],
    arm64: ["aarch64-pc-windows-msvc", "@openai/codex-win32-arm64"],
  },
};

const WRAPPER_PATHS = [
  fileURLToPath(new URL("./codex-wrapper.mjs", import.meta.url)),
  fileURLToPath(new URL("./codex-food-wrapper.mjs", import.meta.url)),
];

function isExecutableFile(path, platform) {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isReadableFile(path) {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function containsNodeModulesBin(path, platform) {
  const pathApi = platform === "win32" ? win32 : posix;
  const segments = pathApi.resolve(path).split(pathApi.sep).map((segment) => segment.toLowerCase());
  return segments.some((segment, index) => segment === "node_modules" && segments[index + 1] === ".bin");
}

function isWorldWritable(path, platform) {
  if (platform === "win32") return false;
  try {
    return (statSync(path).mode & 0o002) !== 0;
  } catch {
    return true;
  }
}

function safeRealpath(path) {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

function fileIdentity(path) {
  try {
    const info = statSync(path);
    return `${info.dev}:${info.ino}`;
  } catch {
    return undefined;
  }
}

function pinnedLocalCommand({ platform, arch, resolvePlatformModule, execPath, cliPath }) {
  // The npm CLI maps Android to a Linux optional dependency. That dependency
  // is not installed by npm on Android, so use the explicit PATH fallback.
  if (platform === "android") return undefined;
  const target = TARGETS[platform]?.[arch];
  if (!target) return undefined;
  const [targetTriple, platformPackage] = target;
  if (!cliPath || !isReadableFile(cliPath)) return undefined;

  const pathApi = platform === "win32" ? win32 : posix;
  const executableName = platform === "win32" ? "codex.exe" : "codex";
  let nativeCandidate;
  try {
    const packageJson = safeRealpath(resolvePlatformModule(cliPath, `${platformPackage}/package.json`));
    if (packageJson) nativeCandidate = pathApi.join(pathApi.dirname(packageJson), "vendor", targetTriple, "bin", executableName);
  } catch {
    // The npm launcher checks its bundled vendor directory only when the
    // optional platform package cannot be resolved.
  }
  nativeCandidate ??= pathApi.join(pathApi.dirname(pathApi.dirname(cliPath)), "vendor", targetTriple, "bin", executableName);
  if (!isExecutableFile(nativeCandidate, platform)) return undefined;

  return Object.freeze({
    command: execPath,
    argsPrefix: Object.freeze([cliPath]),
    source: "pinned-local",
  });
}

function pathFallbackCommand({ platform, pathValue, pathDelimiter, excludedPaths }) {
  const pathApi = platform === "win32" ? win32 : posix;
  const excludedRealpaths = new Set(excludedPaths.map(safeRealpath).filter(Boolean));
  const excludedIdentities = new Set([...excludedRealpaths].map(fileIdentity).filter(Boolean));
  const executableName = platform === "win32" ? "codex.exe" : "codex";

  for (const entry of pathValue.split(pathDelimiter)) {
    if (!entry || !pathApi.isAbsolute(entry) || containsNodeModulesBin(entry, platform)) continue;
    const directory = safeRealpath(entry);
    if (!directory || containsNodeModulesBin(directory, platform) || isWorldWritable(directory, platform)) continue;
    try {
      if (!statSync(directory).isDirectory()) continue;
    } catch {
      continue;
    }

    const candidate = pathApi.join(directory, executableName);
    if (!isExecutableFile(candidate, platform) || isWorldWritable(candidate, platform)) continue;
    const executable = safeRealpath(candidate);
    const identity = executable ? fileIdentity(executable) : undefined;
    if (!executable || containsNodeModulesBin(executable, platform) || excludedRealpaths.has(executable)) continue;
    if (identity && excludedIdentities.has(identity)) continue;
    if (!isExecutableFile(executable, platform) || isWorldWritable(executable, platform)) continue;

    return Object.freeze({
      command: executable,
      argsPrefix: Object.freeze([]),
      source: "path-fallback",
    });
  }
  return undefined;
}

function resolveWith(options) {
  const resolvedOptions = {
    ...options,
    resolvePlatformModule: options.resolvePlatformModule
      ?? ((_cliPath, specifier) => options.resolveModule(specifier)),
  };
  let cliPath;
  try {
    cliPath = safeRealpath(resolvedOptions.resolveModule("@openai/codex/bin/codex.js"));
  } catch {
    // A global native executable can still be used without the npm launcher.
  }
  const local = pinnedLocalCommand({ ...resolvedOptions, cliPath });
  if (local) return local;
  const fallback = pathFallbackCommand({
    ...resolvedOptions,
    excludedPaths: [...resolvedOptions.wrapperPaths, ...(cliPath ? [cliPath] : [])],
  });
  if (fallback) return fallback;
  throw new Error(UNAVAILABLE_MESSAGE);
}

/** Resolve only from the bridge's pinned package or the process PATH. */
export function resolveCodexCommand() {
  return resolveWith({
    platform: process.platform,
    arch: process.arch,
    pathValue: process.env.PATH ?? "",
    pathDelimiter: delimiter,
    resolveModule: (specifier) => require.resolve(specifier),
    resolvePlatformModule: (cliPath, specifier) => createRequire(cliPath).resolve(specifier),
    execPath: process.execPath,
    wrapperPaths: WRAPPER_PATHS,
  });
}

/** @internal Test seam; production wrappers never pass user-controlled paths. */
export function resolveCodexCommandForTest(options) {
  return resolveWith({
    pathDelimiter: delimiter,
    wrapperPaths: WRAPPER_PATHS,
    ...options,
  });
}

export const CODEX_EXECUTABLE_UNAVAILABLE_MESSAGE = UNAVAILABLE_MESSAGE;
