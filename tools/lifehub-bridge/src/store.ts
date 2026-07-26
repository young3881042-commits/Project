import { chmod, mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { BridgeConfig } from "./config.js";
import { randomId, randomSecret } from "./security.js";
import type { BridgeState } from "./types.js";

function initialState(config: BridgeConfig): BridgeState {
  return {
    version: 1,
    bridgeId: randomId("bridge"),
    bridgeName: config.bridgeName,
    devices: [],
    pairCodes: [],
    pairRequests: [],
    projects: [],
    threads: [],
    approvals: [],
  };
}

export class JsonStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(readonly config: BridgeConfig) {}

  async init(): Promise<void> {
    await mkdir(this.config.dataDir, { recursive: true, mode: 0o700 });
    await chmod(this.config.dataDir, 0o700);
    try {
      await readFile(this.config.stateFile, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.writeState(initialState(this.config));
    }
    await chmod(this.config.stateFile, 0o600);
    try {
      await readFile(this.config.adminTokenFile, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const handle = await open(this.config.adminTokenFile, "wx", 0o600);
      try {
        await handle.writeFile(randomSecret(32), "utf8");
      } finally {
        await handle.close();
      }
    }
    await chmod(this.config.adminTokenFile, 0o600);
  }

  async read(): Promise<BridgeState> {
    await this.queue;
    const parsed = JSON.parse(await readFile(this.config.stateFile, "utf8")) as BridgeState;
    if (parsed.version !== 1) throw new Error("지원하지 않는 Bridge 저장 형식입니다.");
    return structuredClone(parsed);
  }

  update<T>(mutator: (state: BridgeState) => T | Promise<T>): Promise<T> {
    const operation = this.queue.then(async () => {
      const state = JSON.parse(await readFile(this.config.stateFile, "utf8")) as BridgeState;
      const result = await mutator(state);
      await this.writeState(state);
      return result;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async readAdminToken(): Promise<string> {
    await this.init();
    return (await readFile(this.config.adminTokenFile, "utf8")).trim();
  }

  private async writeState(state: BridgeState): Promise<void> {
    await mkdir(dirname(this.config.stateFile), { recursive: true, mode: 0o700 });
    const temporary = `${this.config.stateFile}.${process.pid}.${randomId("tmp")}`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.config.stateFile);
  }
}
