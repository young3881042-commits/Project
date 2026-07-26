import { loadConfig } from "./config.js";
import { OfficialCodexAdapter } from "./codex-adapter.js";
import { createBridgeHttpServer } from "./http-server.js";
import { OfficialFoodImageAnalyzer } from "./food-image-analyzer.js";
import { BridgeService } from "./service.js";
import { JsonStore } from "./store.js";

const config = loadConfig();
const store = new JsonStore(config);
const service = new BridgeService(config, store, new OfficialCodexAdapter(), new OfficialFoodImageAnalyzer());
await service.init();
const http = createBridgeHttpServer(service, config);
const address = await http.listen();
const status = await service.adminStatus();
const projects = status.projects as Array<{ id: string; name: string }>;
const devices = status.devices as Array<{ id: string; name: string; permissions: string[] }>;

console.log(`LifeHub Bridge: http://${address.host}:${address.port}`);
console.log(`LAN 연결: ${config.lanEnabled ? "활성" : "비활성 (loopback 전용)"}`);
console.log(`Codex 로그인: ${(status.codex as { loggedIn: boolean }).loggedIn ? "완료" : "필요 - codex login 실행"}`);
console.log(`등록 프로젝트: ${projects.length ? projects.map((project) => `${project.name} (${project.id})`).join(", ") : "없음"}`);
console.log(`연결 기기: ${devices.length ? devices.map((device) => `${device.name} (${device.id}, ${device.permissions.join("/")})`).join(", ") : "없음"}`);
console.log(`관리자 화면: http://${address.host}:${address.port}/admin/`);
console.log("연결 코드는 관리자 화면 또는 `npm run bridge:pair`에서 필요할 때만 발급하세요.");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await http.close();
    process.exit(0);
  });
}
