#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CODEX_EXECUTABLE_UNAVAILABLE_MESSAGE, resolveCodexCommand } from "./codex-executable.mjs";

export function hardenedFoodCodexArgs(input) {
  const args = [...input];
  if (args[0] !== "exec") return args;
  const forced = [];
  if (!args.includes("--ignore-user-config")) forced.push("--ignore-user-config");
  if (!args.includes("--ignore-rules")) forced.push("--ignore-rules");
  if (!args.includes("--ephemeral")) forced.push("--ephemeral");
  args.splice(1, 0, ...forced);
  return args;
}

function main() {
  let target;
  try {
    target = resolveCodexCommand();
  } catch {
    process.stderr.write(`${CODEX_EXECUTABLE_UNAVAILABLE_MESSAGE}\n`);
    process.exitCode = 1;
    return;
  }
  const args = hardenedFoodCodexArgs(process.argv.slice(2));
  const child = spawn(target.command, [...target.argsPrefix, ...args], {
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => child.kill(signal));
  }

  child.once("error", () => {
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
