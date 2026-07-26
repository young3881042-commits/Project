import { lstat, realpath, stat } from "node:fs/promises";
import { dirname, join, parse, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { containsPath, rejectUnsafeRelativePath, truncate } from "./security.js";

export async function validateProjectRoot(input: string): Promise<string> {
  const resolved = resolve(input);
  const info = await stat(resolved);
  if (!info.isDirectory()) throw new Error("프로젝트 경로가 디렉터리가 아닙니다.");
  return realpath(resolved);
}

export async function assertStableProjectRoot(storedRoot: string): Promise<string> {
  const expected = resolve(storedRoot);
  const info = await lstat(expected);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("등록된 프로젝트 루트가 변경되었습니다.");
  const canonical = await realpath(expected);
  if (canonical !== expected) throw new Error("등록된 프로젝트 루트가 외부 경로로 변경되었습니다.");
  return canonical;
}

export async function resolveAllowedProjectPath(projectRoot: string, relativePath: string): Promise<string> {
  rejectUnsafeRelativePath(relativePath);
  const root = await assertStableProjectRoot(projectRoot);
  const candidate = resolve(root, relativePath);
  if (!containsPath(root, candidate)) throw new Error("프로젝트 외부 경로는 허용되지 않습니다.");

  const parts = relative(root, candidate).split(sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) {
        const linked = await realpath(current);
        if (!containsPath(root, linked)) throw new Error("프로젝트 외부를 가리키는 심볼릭 링크는 허용되지 않습니다.");
        current = linked;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const parent = await nearestExistingParent(dirname(current));
        if (!containsPath(root, parent)) throw new Error("프로젝트 외부 경로는 허용되지 않습니다.");
        break;
      }
      throw error;
    }
  }

  try {
    const canonical = await realpath(candidate);
    if (!containsPath(root, canonical)) throw new Error("프로젝트 외부 경로는 허용되지 않습니다.");
    return canonical;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return candidate;
  }
}

async function nearestExistingParent(start: string): Promise<string> {
  let current = start;
  for (;;) {
    try {
      return await realpath(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(current);
      if (parent === current || current === parse(current).root) throw error;
      current = parent;
    }
  }
}

function runGit(root: string, args: string[], limit = 512 * 1024): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, { cwd: root, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let errorOutput = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { output = truncate(output + chunk, limit); });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { errorOutput = truncate(errorOutput + chunk, 8 * 1024); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolvePromise(output) : reject(new Error(errorOutput || `git exited ${code}`)));
  });
}

export async function getProjectChanges(root: string): Promise<{ files: string[]; diff: string }> {
  const [statusOutput, workingTreeDiff, stagedDiff] = await Promise.all([
    runGit(root, ["status", "--short", "--untracked-files=all"]),
    runGit(root, ["diff", "--no-ext-diff", "--no-color", "--relative", "--", "."]),
    runGit(root, ["diff", "--cached", "--no-ext-diff", "--no-color", "--relative", "--", "."]),
  ]);
  const files = statusOutput.split("\n").filter(Boolean).map((line) => line.slice(3).trim()).filter(Boolean);
  const sections = [
    stagedDiff ? `# Staged changes\n${stagedDiff}` : "",
    workingTreeDiff ? `# Working tree changes\n${workingTreeDiff}` : "",
  ].filter(Boolean);
  return { files, diff: truncate(sections.join("\n\n"), 512 * 1024) };
}
