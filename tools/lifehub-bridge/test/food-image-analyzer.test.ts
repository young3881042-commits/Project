import assert from "node:assert/strict";
import { access, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import type { Input, ThreadEvent, ThreadOptions, TurnOptions } from "@openai/codex-sdk";
import type { CodexAdapter, CodexRunRequest } from "../src/codex-adapter.js";
import { loadConfig, type BridgeConfig } from "../src/config.js";
import {
  decodeFoodImageDataUrl,
  FOOD_ANALYSIS_BODY_LIMIT_BYTES,
  FOOD_ANALYSIS_OUTPUT_SCHEMA,
  FOOD_CODEX_SECURITY_CONFIG,
  FoodAnalysisError,
  MAX_FOOD_IMAGE_DIMENSION,
  OfficialFoodImageAnalyzer,
  foodAnalysisThreadOptions,
  validateFoodAnalysisResult,
  type DecodedFoodImage,
  type FoodAnalysisResult,
  type FoodCodexClient,
  type FoodImageAnalyzer,
} from "../src/food-image-analyzer.js";
import { createBridgeHttpServer, type BridgeHttpServer } from "../src/http-server.js";
import { BridgeError, BridgeService } from "../src/service.js";
import { JsonStore } from "../src/store.js";
import type { AuthenticatedDevice, DevicePermission } from "../src/types.js";

const VALID_RESULT: FoodAnalysisResult = {
  foodName: "김치볶음밥",
  caloriesKcal: 620,
  carbohydratesGrams: 88,
  proteinGrams: 18,
  fatGrams: 22,
  confidence: 0.82,
  notes: "보이는 양: 김치볶음밥 약 1그릇(400g), 합계 약 400g. 사진 속 그릇 크기를 기준으로 추정",
};

const VALID_MODEL_RESULT = {
  status: "analyzed",
  ...VALID_RESULT,
  notes: "사진 속 그릇 크기를 기준으로 추정",
  portionItems: [{
    foodName: "김치볶음밥",
    amountDescription: "약 1그릇(400g)",
    estimatedGrams: 400,
    caloriesPer100Grams: 155,
  }],
} as const;

function jpegBytes(size = 8): Buffer {
  const bytes = Buffer.alloc(Math.max(size, 23), 0);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xc0;
  bytes.writeUInt16BE(17, 4);
  bytes[6] = 8;
  bytes.writeUInt16BE(1, 7);
  bytes.writeUInt16BE(1, 9);
  bytes[11] = 3;
  bytes[12] = 1;
  bytes[13] = 0x11;
  bytes[14] = 0;
  bytes[15] = 2;
  bytes[16] = 0x11;
  bytes[17] = 0;
  bytes[18] = 3;
  bytes[19] = 0x11;
  bytes[20] = 0;
  bytes[21] = 0xff;
  bytes[22] = 0xd9;
  return bytes;
}

function pngHeader(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function dataUrl(mimeType: string, bytes: Buffer): string {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function* eventStream(events: ThreadEvent[]): AsyncGenerator<ThreadEvent> {
  for (const event of events) yield event;
}

function completedEvents(finalResponse = JSON.stringify(VALID_MODEL_RESULT)): ThreadEvent[] {
  return [
    { type: "thread.started", thread_id: "food-thread-test" },
    { type: "turn.started" },
    { type: "item.completed", item: { id: "food-message", type: "agent_message", text: finalResponse } },
    {
      type: "turn.completed",
      usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 },
    },
  ] as ThreadEvent[];
}

class CapturingFoodCodex implements FoodCodexClient {
  threadOptions?: ThreadOptions;
  input?: Input;
  turnOptions?: TurnOptions;
  runStreamed: (input: Input, options?: TurnOptions) => Promise<{ events: AsyncIterable<ThreadEvent> }> = async () => ({
    events: eventStream(completedEvents()),
  });

  startThread(options?: ThreadOptions) {
    this.threadOptions = options;
    return {
      runStreamed: async (input: Input, turnOptions?: TurnOptions) => {
        this.input = input;
        this.turnOptions = turnOptions;
        return this.runStreamed(input, turnOptions);
      },
    };
  }
}

class StatusCodexAdapter implements CodexAdapter {
  loggedIn = true;
  status: "logged-in" | "not-logged-in" | "unavailable" = "logged-in";

  async *run(_request: CodexRunRequest): AsyncIterable<ThreadEvent> {
    throw new Error("food tests do not run chat turns");
  }

  async loginStatus() {
    return { loggedIn: this.loggedIn, status: this.status };
  }
}

class ControlledFoodAnalyzer implements FoodImageAnalyzer {
  calls: DecodedFoodImage[] = [];
  signals: Array<AbortSignal | undefined> = [];
  implementation: (image: DecodedFoodImage, signal?: AbortSignal) => Promise<FoodAnalysisResult> = async () => VALID_RESULT;

  async analyze(image: DecodedFoodImage, signal?: AbortSignal): Promise<FoodAnalysisResult> {
    this.calls.push(image);
    this.signals.push(signal);
    return this.implementation(image, signal);
  }
}

interface FoodFixture {
  config: BridgeConfig;
  service: BridgeService;
  adapter: StatusCodexAdapter;
  analyzer: ControlledFoodAnalyzer;
}

const temporaryRoots: string[] = [];
const servers: BridgeHttpServer[] = [];

afterEach(async () => {
  while (servers.length) await servers.pop()!.close().catch(() => undefined);
  while (temporaryRoots.length) await rm(temporaryRoots.pop()!, { recursive: true, force: true }).catch(() => undefined);
});

async function foodFixture(): Promise<FoodFixture> {
  const root = await mkdtemp(join(tmpdir(), "lifehub-food-service-test-"));
  temporaryRoots.push(root);
  const config = loadConfig({
    HOME: root,
    LIFEHUB_BRIDGE_DATA_DIR: join(root, "data"),
  });
  config.port = 0;
  config.bodyLimitBytes = 1_024;
  config.rateLimitMax = 1_000;
  const adapter = new StatusCodexAdapter();
  const analyzer = new ControlledFoodAnalyzer();
  const service = new BridgeService(config, new JsonStore(config), adapter, analyzer);
  await service.init();
  return { config, service, adapter, analyzer };
}

async function pair(
  fixture: FoodFixture,
  permissions: DevicePermission[] = ["chat"],
): Promise<{ token: string; device: AuthenticatedDevice }> {
  const { code } = await fixture.service.createPairCode();
  const request = await fixture.service.requestPairing({
    code,
    deviceName: "food-test-phone",
    requestedPermissions: permissions,
  });
  await fixture.service.approvePairingAsAdmin(request.requestId as string, permissions);
  const claim = await fixture.service.claimPairing({
    requestId: request.requestId,
    requestSecret: request.requestSecret,
  });
  return {
    token: claim.token as string,
    device: await fixture.service.authenticate(claim.token as string),
  };
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("condition timeout");
}

test("음식 이미지 data URL 크기, MIME 및 magic bytes를 엄격히 검사한다", () => {
  const jpeg = decodeFoodImageDataUrl(dataUrl("image/jpeg", jpegBytes()));
  assert.equal(jpeg.mimeType, "image/jpeg");
  assert.equal(jpeg.extension, "jpg");

  assert.throws(
    () => decodeFoodImageDataUrl(dataUrl("image/png", jpegBytes())),
    (error: unknown) => error instanceof FoodAnalysisError && error.status === 415 && error.code === "FOOD_IMAGE_MIME_MISMATCH",
  );
  assert.throws(
    () => decodeFoodImageDataUrl("data:image/gif;base64,R0lGODlh"),
    (error: unknown) => error instanceof FoodAnalysisError && error.status === 415 && error.code === "UNSUPPORTED_FOOD_IMAGE",
  );
  assert.throws(
    () => decodeFoodImageDataUrl(dataUrl("image/jpeg", jpegBytes(1.5 * 1024 * 1024 + 1))),
    (error: unknown) => error instanceof FoodAnalysisError && error.status === 413 && error.code === "FOOD_IMAGE_TOO_LARGE",
  );
  assert.throws(
    () => decodeFoodImageDataUrl(dataUrl("image/jpeg", Buffer.from([0xff, 0xd8, 0xff]))),
    (error: unknown) => error instanceof FoodAnalysisError && error.status === 415 && error.code === "INVALID_FOOD_IMAGE",
  );
  assert.throws(
    () => decodeFoodImageDataUrl(dataUrl("image/png", pngHeader(MAX_FOOD_IMAGE_DIMENSION + 1, 1))),
    (error: unknown) => error instanceof FoodAnalysisError
      && error.status === 413
      && error.code === "FOOD_IMAGE_DIMENSIONS_TOO_LARGE",
  );
  assert.throws(
    () => decodeFoodImageDataUrl(dataUrl("image/png", pngHeader(10_000, 10_000))),
    (error: unknown) => error instanceof FoodAnalysisError
      && error.status === 413
      && error.code === "FOOD_IMAGE_DIMENSIONS_TOO_LARGE",
  );
});

test("음식 분석 출력 필드와 모든 수치/문자열 범위를 서버에서 재검증한다", () => {
  assert.deepEqual(FOOD_ANALYSIS_OUTPUT_SCHEMA.properties.status.enum, ["analyzed", "not_food"]);
  assert.equal(FOOD_ANALYSIS_OUTPUT_SCHEMA.required.includes("status"), true);
  assert.equal(FOOD_ANALYSIS_OUTPUT_SCHEMA.required.includes("portionItems"), true);
  assert.equal(FOOD_ANALYSIS_OUTPUT_SCHEMA.properties.portionItems.maxItems, 12);
  assert.equal(FOOD_ANALYSIS_OUTPUT_SCHEMA.properties.portionItems.items.additionalProperties, false);
  assert.deepEqual(validateFoodAnalysisResult(VALID_RESULT), VALID_RESULT);
  assert.throws(() => validateFoodAnalysisResult({ ...VALID_RESULT, extra: true }), /응답 필드/);
  assert.throws(() => validateFoodAnalysisResult({ ...VALID_RESULT, foodName: "가".repeat(81) }), /텍스트 값/);
  assert.throws(() => validateFoodAnalysisResult({ ...VALID_RESULT, notes: "나".repeat(301) }), /텍스트 값/);
  assert.throws(() => validateFoodAnalysisResult({ ...VALID_RESULT, notes: null }), /텍스트 값/);
  assert.throws(() => validateFoodAnalysisResult({ ...VALID_RESULT, caloriesKcal: 0 }), /칼로리/);
  assert.throws(() => validateFoodAnalysisResult({ ...VALID_RESULT, caloriesKcal: 1.5 }), /칼로리/);
  assert.throws(() => validateFoodAnalysisResult({ ...VALID_RESULT, carbohydratesGrams: Number.NaN }), /영양 수치/);
  assert.throws(() => validateFoodAnalysisResult({ ...VALID_RESULT, proteinGrams: 2_001 }), /영양 수치/);
  assert.throws(() => validateFoodAnalysisResult({ ...VALID_RESULT, confidence: 1.01 }), /영양 수치/);
  assert.throws(
    () => validateFoodAnalysisResult({ ...VALID_RESULT, foodName: "식별 불가", caloriesKcal: 100 }),
    (error: unknown) => error instanceof FoodAnalysisError && error.status === 422 && error.code === "FOOD_NOT_RECOGNIZED",
  );
});

test("전용 Codex client가 local_image/outputSchema와 read-only 보안 설정을 사용하고 임시 파일을 삭제한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "lifehub-food-analyzer-test-"));
  temporaryRoots.push(root);
  const codex = new CapturingFoodCodex();
  let imagePath = "";
  codex.runStreamed = async (input, options) => {
    assert.ok(Array.isArray(input));
    const text = input.find((entry) => entry.type === "text");
    const image = input.find((entry) => entry.type === "local_image");
    assert.ok(text?.type === "text");
    assert.match(text.text, /untrusted image content/);
    assert.match(text.text, /Do not run commands/);
    assert.match(text.text, /partial serving or leftovers/);
    assert.match(text.text, /do not expand it to a complete or standard serving/);
    assert.match(text.text, /empty plate area, containers, bones, shells/);
    assert.match(text.text, /Estimate portions before estimating total calories/);
    assert.match(text.text, /conservative central estimate rather than the upper end/);
    assert.match(text.text, /round\(estimatedGrams \* caloriesPer100Grams \/ 100\)/);
    assert.ok(image?.type === "local_image");
    imagePath = image.path;
    assert.equal(dirname(imagePath).startsWith(root), true);
    assert.deepEqual(await readFile(imagePath), jpegBytes());
    assert.equal((await stat(dirname(imagePath))).mode & 0o777, 0o700);
    assert.equal((await stat(imagePath)).mode & 0o777, 0o600);
    assert.deepEqual(options?.outputSchema, FOOD_ANALYSIS_OUTPUT_SCHEMA);
    assert.equal(options?.signal?.aborted, false);
    return { events: eventStream(completedEvents()) };
  };

  const analyzer = new OfficialFoodImageAnalyzer({ codex, temporaryRoot: root });
  assert.deepEqual(await analyzer.analyze(decodeFoodImageDataUrl(dataUrl("image/jpeg", jpegBytes()))), VALID_RESULT);
  await assert.rejects(access(imagePath));
  assert.deepEqual(await readdir(root), []);
  assert.deepEqual(codex.threadOptions, foodAnalysisThreadOptions(dirname(imagePath)));
  assert.equal(codex.threadOptions?.sandboxMode, "read-only");
  assert.equal(codex.threadOptions?.networkAccessEnabled, false);
  assert.equal(codex.threadOptions?.webSearchMode, "disabled");
  assert.equal(FOOD_CODEX_SECURITY_CONFIG.features.shell_tool, false);
  assert.equal(FOOD_CODEX_SECURITY_CONFIG.features.unified_exec, false);
  assert.equal(FOOD_CODEX_SECURITY_CONFIG.features.apps, false);
  assert.equal(FOOD_CODEX_SECURITY_CONFIG.features.image_generation, false);
  assert.equal(FOOD_CODEX_SECURITY_CONFIG.features.multi_agent, false);
  assert.equal(FOOD_CODEX_SECURITY_CONFIG.features.multi_agent_v2, false);
  assert.deepEqual(FOOD_CODEX_SECURITY_CONFIG.mcp_servers, {});
});

test("보이는 음식별 양과 열량 밀도를 서버에서 합산해 총칼로리의 단일 기준으로 사용한다", async () => {
  const image = decodeFoodImageDataUrl(dataUrl("image/jpeg", jpegBytes()));

  const roundedCodex = new CapturingFoodCodex();
  roundedCodex.runStreamed = async () => ({
    events: eventStream(completedEvents(JSON.stringify({ ...VALID_MODEL_RESULT, caloriesKcal: 635 }))),
  });
  assert.deepEqual(await new OfficialFoodImageAnalyzer({ codex: roundedCodex }).analyze(image), VALID_RESULT);

  const multiplePortionsCodex = new CapturingFoodCodex();
  multiplePortionsCodex.runStreamed = async () => ({
    events: eventStream(completedEvents(JSON.stringify({
      ...VALID_MODEL_RESULT,
      foodName: "밥과 계란",
      caloriesKcal: 230,
      portionItems: [
        {
          foodName: "밥",
          amountDescription: "약 0.5공기(100g)",
          estimatedGrams: 100,
          caloriesPer100Grams: 130,
        },
        {
          foodName: "계란",
          amountDescription: "1개(50g)",
          estimatedGrams: 50,
          caloriesPer100Grams: 200,
        },
      ],
    }))),
  });
  const multiplePortions = await new OfficialFoodImageAnalyzer({ codex: multiplePortionsCodex }).analyze(image);
  assert.equal(multiplePortions.caloriesKcal, 230);
  assert.match(multiplePortions.notes, /^보이는 양: 밥 약 0\.5공기\(100g\), 계란 1개\(50g\), 합계 약 150g\./);

  const inflatedCodex = new CapturingFoodCodex();
  inflatedCodex.runStreamed = async () => ({
    events: eventStream(completedEvents(JSON.stringify({ ...VALID_MODEL_RESULT, caloriesKcal: 900 }))),
  });
  const serverCalculated = await new OfficialFoodImageAnalyzer({ codex: inflatedCodex }).analyze(image);
  assert.equal(serverCalculated.caloriesKcal, 620);

  const subCalorieGarnishCodex = new CapturingFoodCodex();
  subCalorieGarnishCodex.runStreamed = async () => ({
    events: eventStream(completedEvents(JSON.stringify({
      ...VALID_MODEL_RESULT,
      foodName: "두부와 허브",
      caloriesKcal: 101,
      portionItems: [
        {
          foodName: "두부",
          amountDescription: "약 100g",
          estimatedGrams: 100,
          caloriesPer100Grams: 100,
        },
        {
          foodName: "허브",
          amountDescription: "약 1g",
          estimatedGrams: 1,
          caloriesPer100Grams: 1,
        },
      ],
    }))),
  });
  const exactRounded = await new OfficialFoodImageAnalyzer({ codex: subCalorieGarnishCodex }).analyze(image);
  assert.equal(exactRounded.caloriesKcal, 100);

  const malformedPortionCodex = new CapturingFoodCodex();
  malformedPortionCodex.runStreamed = async () => ({
    events: eventStream(completedEvents(JSON.stringify({
      ...VALID_MODEL_RESULT,
      portionItems: [{ ...VALID_MODEL_RESULT.portionItems[0], hiddenServingGrams: 300 }],
    }))),
  });
  await assert.rejects(
    new OfficialFoodImageAnalyzer({ codex: malformedPortionCodex }).analyze(image),
    (error: unknown) => error instanceof FoodAnalysisError
      && error.status === 502
      && error.code === "FOOD_ANALYSIS_INVALID_RESPONSE",
  );
});

test("음식 전용 wrapper가 사용자 설정·규칙·세션 저장을 끄고 analyzer만 이를 사용한다", async () => {
  const wrapper = await import("../bin/codex-food-wrapper.mjs") as {
    hardenedFoodCodexArgs(input: string[]): string[];
  };
  assert.deepEqual(
    wrapper.hardenedFoodCodexArgs(["exec", "--json", "prompt"]),
    ["exec", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--json", "prompt"],
  );
  assert.deepEqual(
    wrapper.hardenedFoodCodexArgs(["exec", "--ephemeral", "--ignore-rules", "--ignore-user-config", "prompt"]),
    ["exec", "--ephemeral", "--ignore-rules", "--ignore-user-config", "prompt"],
  );
  assert.deepEqual(wrapper.hardenedFoodCodexArgs(["login", "status"]), ["login", "status"]);
  const analyzerSource = await readFile(join(process.cwd(), "src/food-image-analyzer.ts"), "utf8");
  assert.match(analyzerSource, /codex-food-wrapper\.mjs/);
});

test("임시 이미지 janitor는 오래된 전용 디렉터리만 지우고 fresh 및 symlink는 보존한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "lifehub-food-janitor-test-"));
  temporaryRoots.push(root);
  const stale = join(root, "lifehub-food-stale");
  const fresh = join(root, "lifehub-food-fresh");
  const outside = join(root, "outside");
  const link = join(root, "lifehub-food-link");
  await mkdir(stale, { mode: 0o700 });
  await writeFile(join(stale, "food.jpg"), jpegBytes(), { mode: 0o600 });
  await mkdir(fresh, { mode: 0o700 });
  await mkdir(outside, { mode: 0o700 });
  await symlink(outside, link, "dir");
  const old = new Date(Date.now() - 2 * 60 * 60_000);
  await utimes(stale, old, old);

  const analyzer = new OfficialFoodImageAnalyzer({ codex: new CapturingFoodCodex(), temporaryRoot: root });
  assert.deepEqual(await analyzer.analyze(decodeFoodImageDataUrl(dataUrl("image/jpeg", jpegBytes()))), VALID_RESULT);
  await assert.rejects(access(stale));
  assert.equal((await stat(fresh)).isDirectory(), true);
  assert.equal((await lstat(link)).isSymbolicLink(), true);
});

test("Codex 실패, timeout, 취소, 잘못된 결과와 시작 단계 도구 호출을 fail-closed 처리한다", async (context) => {
  const image = decodeFoodImageDataUrl(dataUrl("image/jpeg", jpegBytes()));

  for (const [name, detail, expectedStatus, expectedCode] of [
    ["usage", "out of credits private-token", 429, "CODEX_USAGE_LIMIT"],
    ["login", "401 invalid credentials private-token", 503, "CODEX_LOGIN_REQUIRED"],
    ["unavailable", "Codex executable is unavailable private-path", 503, "CODEX_UNAVAILABLE"],
  ] as const) {
    await context.test(name, async () => {
      const root = await mkdtemp(join(tmpdir(), `lifehub-food-${name}-test-`));
      temporaryRoots.push(root);
      const codex = new CapturingFoodCodex();
      codex.runStreamed = async () => { throw new Error(detail); };
      await assert.rejects(
        new OfficialFoodImageAnalyzer({ codex, temporaryRoot: root }).analyze(image),
        (error: unknown) => error instanceof FoodAnalysisError
          && error.status === expectedStatus
          && error.code === expectedCode
          && !error.message.includes("private"),
      );
      assert.deepEqual(await readdir(root), []);
    });
  }

  await context.test("timeout", async () => {
    const root = await mkdtemp(join(tmpdir(), "lifehub-food-timeout-test-"));
    temporaryRoots.push(root);
    const codex = new CapturingFoodCodex();
    let aborted = false;
    codex.runStreamed = async (_input, options) => ({
      events: (async function* () {
        await new Promise<void>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            aborted = true;
            setTimeout(() => reject(new DOMException("private abort", "AbortError")), 20);
          }, { once: true });
        });
        yield* eventStream([]);
      })(),
    });
    await assert.rejects(
      new OfficialFoodImageAnalyzer({ codex, temporaryRoot: root, timeoutMs: 20, settleGraceMs: 100 }).analyze(image),
      (error: unknown) => error instanceof FoodAnalysisError && error.status === 504 && error.code === "FOOD_ANALYSIS_TIMEOUT",
    );
    assert.equal(aborted, true);
    assert.deepEqual(await readdir(root), []);
  });

  await context.test("client cancellation", async () => {
    const root = await mkdtemp(join(tmpdir(), "lifehub-food-cancel-test-"));
    temporaryRoots.push(root);
    const codex = new CapturingFoodCodex();
    codex.runStreamed = async (_input, options) => ({
      events: (async function* () {
        await new Promise<void>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(new DOMException("private abort", "AbortError")), { once: true });
        });
        yield* eventStream([]);
      })(),
    });
    const controller = new AbortController();
    const pending = new OfficialFoodImageAnalyzer({ codex, temporaryRoot: root, settleGraceMs: 100 }).analyze(image, controller.signal);
    await waitFor(() => Boolean(codex.turnOptions));
    controller.abort();
    await assert.rejects(
      pending,
      (error: unknown) => error instanceof FoodAnalysisError && error.status === 499 && error.code === "FOOD_ANALYSIS_CANCELLED",
    );
    assert.deepEqual(await readdir(root), []);
  });

  await context.test("invalid JSON", async () => {
    const codex = new CapturingFoodCodex();
    codex.runStreamed = async () => ({ events: eventStream(completedEvents("not-json private-response")) });
    await assert.rejects(
      new OfficialFoodImageAnalyzer({ codex }).analyze(image),
      (error: unknown) => error instanceof FoodAnalysisError
        && error.code === "FOOD_ANALYSIS_INVALID_RESPONSE"
        && !error.message.includes("private-response"),
    );
  });

  await context.test("not food", async () => {
    const codex = new CapturingFoodCodex();
    const result = JSON.stringify({
      status: "not_food",
      portionItems: [],
      foodName: "",
      caloriesKcal: 0,
      carbohydratesGrams: 0,
      proteinGrams: 0,
      fatGrams: 0,
      confidence: 0,
      notes: "사진에서 분석 가능한 음식을 식별하지 못했습니다.",
    });
    codex.runStreamed = async () => ({ events: eventStream(completedEvents(result)) });
    await assert.rejects(
      new OfficialFoodImageAnalyzer({ codex }).analyze(image),
      (error: unknown) => error instanceof FoodAnalysisError && error.status === 422 && error.code === "FOOD_NOT_RECOGNIZED",
    );
  });

  await context.test("tool started", async () => {
    const codex = new CapturingFoodCodex();
    codex.runStreamed = async () => ({
      events: eventStream([
        { type: "thread.started", thread_id: "food-tool-thread" },
        { type: "turn.started" },
        { type: "item.started", item: { id: "tool-1", type: "command_execution", command: "id", status: "in_progress" } },
      ] as ThreadEvent[]),
    });
    await assert.rejects(
      new OfficialFoodImageAnalyzer({ codex }).analyze(image),
      (error: unknown) => error instanceof FoodAnalysisError
        && error.status === 502
        && error.code === "FOOD_ANALYSIS_POLICY_VIOLATION",
    );
  });
});

test("음식 분석은 API 키 없이 로그인된 Codex만 사용하도록 서버에 고정된다", async () => {
  const example = await readFile(join(process.cwd(), ".env.example"), "utf8");
  assert.doesNotMatch(example, /^OPENAI_(?:API_KEY|VISION_MODEL)=/m);
  const serverMain = await readFile(join(process.cwd(), "src/server-main.ts"), "utf8");
  assert.match(serverMain, /new OfficialFoodImageAnalyzer\(\)/);
  assert.doesNotMatch(serverMain, /OpenAIFoodImageAnalyzer|OPENAI_API_KEY/);
});

test("APK HTTP 요청부터 로그인된 Codex worker와 최종 JSON까지 종단 간 연결한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "lifehub-food-e2e-test-"));
  temporaryRoots.push(root);
  const config = loadConfig({ HOME: root, LIFEHUB_BRIDGE_DATA_DIR: join(root, "data") });
  config.port = 0;
  const adapter = new StatusCodexAdapter();
  const codex = new CapturingFoodCodex();
  const analyzer = new OfficialFoodImageAnalyzer({ codex, temporaryRoot: root });
  const service = new BridgeService(config, new JsonStore(config), adapter, analyzer);
  await service.init();
  const pairingFixture: FoodFixture = { config, service, adapter, analyzer: new ControlledFoodAnalyzer() };
  const { token } = await pair(pairingFixture);
  const http = createBridgeHttpServer(service, config);
  servers.push(http);
  const bridgeAddress = await http.listen();

  const response = await fetch(`http://127.0.0.1:${bridgeAddress.port}/api/food/analyze`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), VALID_RESULT);
  assert.ok(Array.isArray(codex.input));
  assert.equal(codex.input.some((entry) => entry.type === "local_image"), true);
  assert.deepEqual(codex.turnOptions?.outputSchema, FOOD_ANALYSIS_OUTPUT_SCHEMA);
});

test("같은 기기의 동시 분석을 409로 막고 성공과 실패 뒤 잠금을 해제한다", async () => {
  const fixture = await foodFixture();
  const { device } = await pair(fixture);
  let resolveFirst!: (value: FoodAnalysisResult) => void;
  fixture.analyzer.implementation = async () => new Promise((resolve) => { resolveFirst = resolve; });

  const first = fixture.service.analyzeFood(device, { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) });
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    fixture.service.analyzeFood(device, { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
    (error: unknown) => error instanceof BridgeError && error.status === 409 && error.code === "FOOD_ANALYSIS_IN_PROGRESS",
  );
  resolveFirst(VALID_RESULT);
  assert.deepEqual(await first, VALID_RESULT);

  fixture.analyzer.implementation = async () => {
    throw new FoodAnalysisError(502, "FOOD_ANALYSIS_MODEL_FAILED", "safe model failure");
  };
  await assert.rejects(
    fixture.service.analyzeFood(device, { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
    (error: unknown) => error instanceof BridgeError && error.code === "FOOD_ANALYSIS_MODEL_FAILED",
  );
  fixture.analyzer.implementation = async () => VALID_RESULT;
  assert.deepEqual(
    await fixture.service.analyzeFood(device, { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
    VALID_RESULT,
  );
});

test("외부 AbortSignal을 analyzer에 전달하고 결과 race를 폐기한 뒤 기기 잠금을 해제한다", async () => {
  const fixture = await foodFixture();
  const { device } = await pair(fixture);
  let started = false;
  let analyzerAborted = false;
  fixture.analyzer.implementation = async (_image, signal) => new Promise((resolve) => {
    started = true;
    signal?.addEventListener("abort", () => {
      analyzerAborted = true;
      resolve(VALID_RESULT);
    }, { once: true });
  });
  const controller = new AbortController();
  const pending = fixture.service.analyzeFood(
    device,
    { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) },
    controller.signal,
  );
  await waitFor(() => started);
  controller.abort();
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof BridgeError && error.status === 499 && error.code === "FOOD_ANALYSIS_CANCELLED",
  );
  assert.equal(analyzerAborted, true);

  fixture.analyzer.implementation = async () => VALID_RESULT;
  assert.deepEqual(
    await fixture.service.analyzeFood(device, { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
    VALID_RESULT,
  );
});

test("기기 폐기는 진행 중 음식 분석을 abort하고 늦은 결과를 반환하지 않는다", async () => {
  const fixture = await foodFixture();
  const { device } = await pair(fixture);
  let started = false;
  let analyzerAborted = false;
  fixture.analyzer.implementation = async (_image, signal) => new Promise((resolve) => {
    started = true;
    signal?.addEventListener("abort", () => {
      analyzerAborted = true;
      resolve(VALID_RESULT);
    }, { once: true });
  });
  const pending = fixture.service.analyzeFood(device, { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) });
  await waitFor(() => started);
  await fixture.service.revokeDevice(device);
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof BridgeError && error.status === 499 && error.code === "FOOD_ANALYSIS_CANCELLED",
  );
  assert.equal(analyzerAborted, true);
  const internals = fixture.service as unknown as { foodAnalysisRunning: Map<string, AbortController> };
  assert.equal(internals.foodAnalysisRunning.has(device.id), false);
});

test("음식 HTTP endpoint는 device Bearer/chat 권한과 전용 약 2.2MiB JSON 제한을 적용한다", async () => {
  const fixture = await foodFixture();
  const { token } = await pair(fixture);
  await assert.rejects(
    fixture.service.analyzeFood(
      { id: "no-chat", name: "no-chat", permissions: [] },
      { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) },
    ),
    (error: unknown) => error instanceof BridgeError && error.status === 403 && error.code === "PERMISSION_DENIED",
  );
  const http = createBridgeHttpServer(fixture.service, fixture.config);
  servers.push(http);
  const address = await http.listen();
  const url = `http://127.0.0.1:${address.port}/api/food/analyze`;
  const imageDataUrl = dataUrl("image/jpeg", jpegBytes(2_048));

  assert.equal((await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl }),
  })).status, 401);

  const analyzerCallsBeforeInjection = fixture.analyzer.calls.length;
  const injected = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl, apiKey: "client-must-not-control-this", model: "client-model" }),
  });
  assert.equal(injected.status, 400);
  assert.equal(fixture.analyzer.calls.length, analyzerCallsBeforeInjection);

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), VALID_RESULT);
  assert.equal(fixture.analyzer.calls.at(-1)?.bytes.length, 2_048);

  assert.equal((await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
    body: JSON.stringify({ imageDataUrl }),
  })).status, 415);

  const oversizedBody = JSON.stringify({ imageDataUrl: "x".repeat(FOOD_ANALYSIS_BODY_LIMIT_BYTES) });
  assert.equal((await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: oversizedBody,
  })).status, 413);
});

test("음식 HTTP endpoint는 기기별 분당 분석 요청을 별도로 제한한다", async () => {
  const fixture = await foodFixture();
  const { token } = await pair(fixture);
  const http = createBridgeHttpServer(fixture.service, fixture.config);
  servers.push(http);
  const address = await http.listen();
  const url = `http://127.0.0.1:${address.port}/api/food/analyze`;
  const request = () => fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
  });
  for (let index = 0; index < 10; index += 1) assert.equal((await request()).status, 200);
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.match(limited.headers.get("retry-after") || "", /^\d+$/);
  assert.deepEqual(await limited.json(), {
    error: {
      code: "FOOD_ANALYSIS_RATE_LIMITED",
      message: "음식 사진 분석 요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
    },
  });
});

test("음식 HTTP client disconnect를 analyzer abort로 전달하고 다음 요청 잠금을 해제한다", async () => {
  const fixture = await foodFixture();
  const { token } = await pair(fixture);
  let started = false;
  let disconnectSignalObserved = false;
  fixture.analyzer.implementation = async (_image, signal) => new Promise((resolve) => {
    started = true;
    signal?.addEventListener("abort", () => {
      disconnectSignalObserved = true;
      resolve(VALID_RESULT);
    }, { once: true });
  });
  const http = createBridgeHttpServer(fixture.service, fixture.config);
  servers.push(http);
  const address = await http.listen();
  const url = `http://127.0.0.1:${address.port}/api/food/analyze`;
  const requestController = new AbortController();
  const request = fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
    signal: requestController.signal,
  });
  await waitFor(() => started);
  requestController.abort();
  await assert.rejects(request, /abort/i);
  await waitFor(() => disconnectSignalObserved);

  fixture.analyzer.implementation = async () => VALID_RESULT;
  let completed = false;
  await waitFor(async () => {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
    });
    if (response.status === 409) return false;
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), VALID_RESULT);
    completed = true;
    return true;
  });
  assert.equal(completed, true);
});

test("음식 분석은 Codex 로그인을 먼저 확인하고 analyzer 오류를 안전한 BridgeError로 반환한다", async () => {
  const fixture = await foodFixture();
  const { device } = await pair(fixture);
  fixture.adapter.loggedIn = false;
  fixture.adapter.status = "not-logged-in";
  await assert.rejects(
    fixture.service.analyzeFood(device, { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
    (error: unknown) => error instanceof BridgeError
      && error.status === 503
      && error.code === "CODEX_LOGIN_REQUIRED",
  );
  assert.equal(fixture.analyzer.calls.length, 0);

  fixture.adapter.status = "unavailable";
  await assert.rejects(
    fixture.service.analyzeFood(device, { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
    (error: unknown) => error instanceof BridgeError
      && error.status === 503
      && error.code === "CODEX_UNAVAILABLE",
  );
  assert.equal(fixture.analyzer.calls.length, 0);

  fixture.adapter.loggedIn = true;
  fixture.adapter.status = "logged-in";
  fixture.analyzer.implementation = async () => ({ ...VALID_RESULT, extra: true } as FoodAnalysisResult);
  await assert.rejects(
    fixture.service.analyzeFood(device, { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
    (error: unknown) => error instanceof BridgeError
      && error.status === 502
      && error.code === "FOOD_ANALYSIS_INVALID_RESPONSE",
  );

  fixture.analyzer.implementation = async () => { throw new Error("private-analyzer-detail"); };
  await assert.rejects(
    fixture.service.analyzeFood(device, { imageDataUrl: dataUrl("image/jpeg", jpegBytes()) }),
    (error: unknown) => error instanceof BridgeError
      && error.status === 502
      && error.code === "FOOD_ANALYSIS_FAILED"
      && !error.message.includes("private-analyzer-detail"),
  );
});
