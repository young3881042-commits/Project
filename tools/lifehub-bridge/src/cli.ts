#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loadConfig } from "./config.js";
import { OfficialCodexAdapter } from "./codex-adapter.js";
import { BridgeError, BridgeService } from "./service.js";
import { JsonStore } from "./store.js";
import type { DevicePermission } from "./types.js";

const config = loadConfig();
const service = new BridgeService(config, new JsonStore(config), new OfficialCodexAdapter());
await service.init();

function usage(): never {
  console.log(`LifeHub Bridge CLI

  lifehub-bridge status
  lifehub-bridge pair create
  lifehub-bridge pair list
  lifehub-bridge pair approve <request-id> [permission,permission] [--yes]
  lifehub-bridge pair reject <request-id> [--yes]
  lifehub-bridge pair revoke <device-id> [--yes]
  lifehub-bridge project add <path> [name]
  lifehub-bridge project list
  lifehub-bridge project remove <id-or-name>
`);
  process.exit(1);
}

function printStatus(status: Record<string, unknown>): void {
  const bridge = status.bridge as { address: string; name: string; lanEnabled: boolean };
  const codex = status.codex as { loggedIn: boolean };
  const projects = status.projects as Array<{ id: string; name: string }>;
  const devices = status.devices as Array<{ id: string; name: string; permissions: string[] }>;
  const pending = status.pendingPairRequests as Array<{ id: string; deviceName: string; requestedPermissions: string[]; expiresAt: string }>;
  console.log(`Bridge 주소: http://${bridge.address}`);
  console.log(`PC 이름: ${bridge.name}`);
  console.log(`LAN 연결: ${bridge.lanEnabled ? "활성" : "비활성 (127.0.0.1 기본)"}`);
  console.log(`Codex 로그인: ${codex.loggedIn ? "완료" : "안 됨 - codex login 실행"}`);
  console.log(`등록 프로젝트: ${projects.length ? projects.map((project) => `${project.name} (${project.id})`).join(", ") : "없음"}`);
  console.log(`연결 기기: ${devices.length ? devices.map((device) => `${device.name} (${device.id}, ${device.permissions.join("/")})`).join(", ") : "없음"}`);
  console.log(`승인 대기: ${pending.length ? pending.map((request) => `${request.deviceName} (${request.id}, ${request.requestedPermissions.join("/")}, ~${request.expiresAt})`).join(", ") : "없음"}`);
}

async function confirm(text: string, yes: boolean): Promise<void> {
  if (yes) return;
  if (!stdin.isTTY) throw new BridgeError(400, "CONFIRMATION_REQUIRED", "대화형 터미널에서 확인하거나 --yes를 명시하세요.");
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question(`${text}\n허용하려면 ALLOW를 입력하세요: `);
    if (answer !== "ALLOW") throw new BridgeError(403, "USER_CANCELLED", "사용자가 작업을 취소했습니다.");
  } finally {
    prompt.close();
  }
}

async function main(args: string[]): Promise<void> {
  const [group, action, first, second] = args;
  if (group === "status") {
    printStatus(await service.adminStatus());
    console.log("연결 코드: npm run bridge:pair 로 일회용 코드를 생성하세요.");
    return;
  }

  if (group === "project") {
    if (action === "add" && first) {
      const project = await service.registerProject(first, second);
      console.log(`프로젝트 등록: ${project.name} (${project.id})`);
      return;
    }
    if (action === "list") {
      const status = await service.adminStatus();
      const projects = status.projects as Array<{ id: string; name: string }>;
      if (!projects.length) console.log("등록된 프로젝트가 없습니다.");
      for (const project of projects) console.log(`${project.id}\t${project.name}`);
      return;
    }
    if (action === "remove" && first) {
      await service.removeProject(first);
      console.log(`프로젝트 제거: ${first}`);
      return;
    }
    usage();
  }

  if (group === "pair") {
    if (!action || action === "create") {
      const pair = await service.createPairCode();
      printStatus(await service.adminStatus());
      console.log(`연결 코드: ${pair.code}`);
      console.log(`코드 만료: ${pair.expiresAt}`);
      console.log("휴대폰 요청 후 `lifehub-bridge pair list`에서 기기와 요청 권한을 확인하세요.");
      return;
    }
    if (action === "list") {
      printStatus(await service.adminStatus());
      return;
    }
    const yes = args.includes("--yes");
    if (action === "approve" && first) {
      const status = await service.adminStatus();
      const pending = (status.pendingPairRequests as Array<{ id: string; deviceName: string; requestedPermissions: DevicePermission[] }>).find((request) => request.id === first);
      if (!pending) throw new BridgeError(404, "PAIR_REQUEST_NOT_FOUND", "승인 대기 중인 요청을 찾을 수 없습니다.");
      const permissions = second && !second.startsWith("--") ? second.split(",") : pending.requestedPermissions;
      await confirm(`기기: ${pending.deviceName}\n요청 권한: ${pending.requestedPermissions.join(", ")}\n허용 권한: ${permissions.join(", ")}`, yes);
      const approved = await service.approvePairingAsAdmin(first, permissions);
      console.log(`페어링 승인: ${approved.deviceName} (${(approved.permissions as string[]).join(", ")})`);
      return;
    }
    if (action === "reject" && first) {
      await confirm(`페어링 요청 ${first}을 거부합니다.`, yes);
      await service.rejectPairingAsAdmin(first);
      console.log(`페어링 거부: ${first}`);
      return;
    }
    if (action === "revoke" && first) {
      await confirm(`기기 ${first}의 토큰을 즉시 폐기합니다.`, yes);
      await service.revokeDevice(undefined, first);
      console.log(`기기 토큰 폐기: ${first}`);
      return;
    }
    usage();
  }
  usage();
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof BridgeError) console.error(`${error.code}: ${error.message}`);
  else console.error("Bridge CLI 작업에 실패했습니다.");
  process.exitCode = 1;
}
