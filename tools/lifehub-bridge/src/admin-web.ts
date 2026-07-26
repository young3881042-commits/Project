export const ADMIN_USERNAME = "orbit";

export const ADMIN_HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Orbit 관리자</title>
  <link rel="stylesheet" href="/admin/admin.css">
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">ORBIT CONTROL</p>
        <h1>관리자</h1>
      </div>
      <div id="connection" class="connection pending"><span></span>확인 중</div>
    </header>

    <section class="hero card">
      <div>
        <p class="label">새 휴대폰 연결</p>
        <button id="pair-code" class="pair-code" type="button" title="코드 복사">------</button>
        <p id="pair-expiry" class="muted">버튼을 눌러 일회용 코드를 만드세요.</p>
      </div>
      <button id="create-code" class="primary" type="button">새 코드 발급</button>
    </section>

    <section class="grid">
      <article class="card">
        <div class="section-title">
          <div>
            <p class="label">연결 진행 중</p>
            <h2>페어링 상태</h2>
          </div>
          <span id="pending-count" class="count">0</span>
        </div>
        <div id="pending-list" class="list"></div>
      </article>

      <article class="card">
        <div class="section-title">
          <div>
            <p class="label">연결 완료</p>
            <h2>등록된 기기</h2>
          </div>
          <span id="device-count" class="count">0</span>
        </div>
        <div id="device-list" class="list"></div>
      </article>
    </section>

    <section class="status-card card">
      <div><span>Bridge</span><strong id="bridge-status">확인 중</strong></div>
      <div><span>Codex</span><strong id="codex-status">확인 중</strong></div>
      <button id="refresh" class="quiet" type="button">새로고침</button>
    </section>

    <p id="notice" class="notice" role="status" aria-live="polite"></p>
  </main>
  <script src="/admin/admin.js" defer></script>
</body>
</html>
`;

export const ADMIN_CSS = `:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #f7f7fb;
  background: #09090d;
  font-synthesis: none;
}
* { box-sizing: border-box; }
body {
  min-height: 100vh;
  margin: 0;
  background:
    radial-gradient(circle at 10% -10%, rgba(119, 87, 255, .24), transparent 34rem),
    radial-gradient(circle at 100% 20%, rgba(51, 199, 255, .10), transparent 30rem),
    #09090d;
}
button { font: inherit; }
.shell { width: min(1040px, calc(100% - 32px)); margin: 0 auto; padding: 42px 0 64px; }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.eyebrow, .label { margin: 0 0 7px; color: #8d8d9e; font-size: 12px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(30px, 5vw, 46px); letter-spacing: -.045em; }
h2 { margin: 0; font-size: 20px; letter-spacing: -.025em; }
.connection { display: flex; align-items: center; gap: 8px; color: #a9a9b7; font-size: 13px; font-weight: 700; }
.connection span { width: 9px; height: 9px; border-radius: 50%; background: #ffbd4a; box-shadow: 0 0 18px currentColor; }
.connection.online span { background: #5ee29a; }
.connection.offline span { background: #ff6578; }
.card { border: 1px solid #25252f; border-radius: 22px; background: rgba(20, 20, 27, .88); box-shadow: 0 24px 80px rgba(0, 0, 0, .22); }
.hero { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 28px; margin-bottom: 18px; }
.pair-code { display: block; margin: 0; padding: 0; border: 0; color: #fff; background: transparent; font-size: clamp(42px, 9vw, 72px); font-weight: 820; letter-spacing: .11em; line-height: 1.05; cursor: pointer; }
.muted { min-height: 20px; margin: 9px 0 0; color: #8d8d9e; font-size: 13px; }
.primary, .quiet, .approve, .reject, .revoke { border-radius: 13px; cursor: pointer; font-weight: 760; transition: transform .15s ease, opacity .15s ease, background .15s ease; }
button:active { transform: scale(.97); }
button:disabled { cursor: wait; opacity: .55; }
.primary { min-width: 148px; padding: 14px 18px; border: 0; color: white; background: linear-gradient(135deg, #7657ff, #4d72ff); box-shadow: 0 12px 30px rgba(82, 88, 255, .30); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.grid > .card { min-height: 300px; padding: 24px; }
.section-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.count { display: grid; place-items: center; min-width: 30px; height: 30px; padding: 0 9px; border: 1px solid #343441; border-radius: 999px; color: #bbbccc; background: #1b1b23; font-size: 13px; font-weight: 800; }
.list { display: grid; gap: 10px; }
.empty { display: grid; place-items: center; min-height: 180px; color: #6f6f7d; text-align: center; font-size: 14px; }
.row { padding: 16px; border: 1px solid #2b2b36; border-radius: 16px; background: #181820; }
.row-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.device-name { margin: 0; color: #f7f7fb; font-size: 15px; font-weight: 780; overflow-wrap: anywhere; }
.meta { margin: 5px 0 0; color: #858593; font-size: 12px; overflow-wrap: anywhere; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.chip { padding: 5px 8px; border-radius: 999px; color: #bfb4ff; background: #29233f; font-size: 11px; font-weight: 720; }
.actions { display: flex; gap: 7px; margin-top: 14px; }
.approve, .reject, .revoke, .quiet { padding: 9px 12px; border: 1px solid transparent; color: #e9e9ef; background: #292934; font-size: 12px; }
.approve { color: #101815; background: #63e6a1; }
.reject, .revoke { border-color: #4a2930; color: #ff94a1; background: #2a191e; }
.claim-wait { margin: 0; color: #9fd8ff; font-size: 12px; font-weight: 720; }
.status-card { display: flex; align-items: center; gap: 30px; margin-top: 18px; padding: 17px 20px; }
.status-card > div { display: flex; gap: 9px; font-size: 13px; }
.status-card span { color: #777785; }
.status-card strong { color: #d7d7df; }
.status-card .quiet { margin-left: auto; }
.notice { position: fixed; right: 22px; bottom: 18px; max-width: min(420px, calc(100% - 44px)); margin: 0; padding: 12px 15px; border: 1px solid transparent; border-radius: 13px; color: transparent; background: transparent; font-size: 13px; pointer-events: none; transform: translateY(12px); transition: all .2s ease; }
.notice.show { border-color: #373744; color: #eeeeF4; background: #202029; box-shadow: 0 18px 55px rgba(0,0,0,.38); transform: translateY(0); }
.notice.error { border-color: #63313b; color: #ffd2d7; background: #321a20; }
@media (max-width: 720px) {
  .shell { width: min(100% - 22px, 1040px); padding-top: 24px; }
  .hero { align-items: stretch; flex-direction: column; padding: 22px; }
  .primary { width: 100%; }
  .grid { grid-template-columns: 1fr; }
  .grid > .card { min-height: 260px; padding: 20px; }
  .status-card { align-items: flex-start; flex-wrap: wrap; gap: 12px 22px; }
  .status-card .quiet { width: 100%; margin-left: 0; }
}
`;

export const ADMIN_JS = `(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const pairCode = byId("pair-code");
  const pairExpiry = byId("pair-expiry");
  const createCode = byId("create-code");
  const pendingList = byId("pending-list");
  const deviceList = byId("device-list");
  const notice = byId("notice");
  let noticeTimer;

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const showNotice = (message, error) => {
    clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.className = error ? "notice show error" : "notice show";
    noticeTimer = setTimeout(() => { notice.className = "notice"; }, 3200);
  };

  const request = async (path, options) => {
    const init = Object.assign({ credentials: "same-origin" }, options || {});
    if (init.body) init.headers = Object.assign({ "Content-Type": "application/json" }, init.headers || {});
    const response = await fetch(path, init);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload && payload.error && payload.error.message;
      throw new Error(message || "관리자 요청에 실패했습니다.");
    }
    return payload;
  };

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("ko-KR", {
      month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).format(date);
  };

  const empty = (message) => node("div", "empty", message);

  const chipList = (values) => {
    const container = node("div", "chips");
    values.forEach((value) => container.append(node("span", "chip", value)));
    return container;
  };

  const runAction = async (button, work, success) => {
    button.disabled = true;
    try {
      await work();
      showNotice(success, false);
      await refresh();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "요청에 실패했습니다.", true);
    } finally {
      button.disabled = false;
    }
  };

  const renderPending = (pendingRows, awaitingRows) => {
    const rows = [
      ...pendingRows,
      ...awaitingRows.map((item) => Object.assign({}, item, { status: "approved" }))
    ];
    byId("pending-count").textContent = String(rows.length);
    pendingList.replaceChildren();
    if (!rows.length) {
      pendingList.append(empty("새 페어링 요청이나 연결 완료 대기가 없습니다."));
      return;
    }
    rows.forEach((item) => {
      const row = node("div", "row");
      const head = node("div", "row-head");
      const info = node("div");
      info.append(node("p", "device-name", item.deviceName));
      info.append(node("p", "meta", "만료 " + formatDate(item.expiresAt)));
      head.append(info);
      row.append(head, chipList(item.approvedPermissions || item.requestedPermissions || []));
      const actions = node("div", "actions");
      if (item.status === "approved") {
        actions.append(node("p", "claim-wait", "승인됨 · 휴대폰 연결 완료 대기"));
        row.append(actions);
        pendingList.append(row);
        return;
      }
      const approve = node("button", "approve", "승인");
      approve.type = "button";
      approve.addEventListener("click", () => {
        if (!window.confirm(item.deviceName + " 기기를 승인할까요?")) return;
        runAction(approve, () => request("/admin/api/pair/approve", {
          method: "POST", body: JSON.stringify({ requestId: item.id })
        }), "접속을 허용했습니다. 휴대폰에서 연결을 마무리하는 중입니다.");
      });
      const reject = node("button", "reject", "거절");
      reject.type = "button";
      reject.addEventListener("click", () => {
        if (!window.confirm(item.deviceName + " 요청을 거절할까요?")) return;
        runAction(reject, () => request("/admin/api/pair/reject", {
          method: "POST", body: JSON.stringify({ requestId: item.id })
        }), "요청을 거절했습니다.");
      });
      actions.append(approve, reject);
      row.append(actions);
      pendingList.append(row);
    });
  };

  const renderDevices = (rows) => {
    byId("device-count").textContent = String(rows.length);
    deviceList.replaceChildren();
    if (!rows.length) {
      deviceList.append(empty("연결된 기기가 없습니다."));
      return;
    }
    rows.forEach((item) => {
      const row = node("div", "row");
      row.append(node("p", "device-name", item.name));
      row.append(node("p", "meta", "최근 접속 " + formatDate(item.lastSeenAt)));
      row.append(chipList(item.permissions || []));
      const actions = node("div", "actions");
      const revoke = node("button", "revoke", "연결 해제");
      revoke.type = "button";
      revoke.addEventListener("click", () => {
        if (!window.confirm(item.name + " 기기의 접근을 즉시 해제할까요?")) return;
        runAction(revoke, () => request("/admin/api/device/revoke", {
          method: "POST", body: JSON.stringify({ deviceId: item.id })
        }), "기기 연결을 해제했습니다.");
      });
      actions.append(revoke);
      row.append(actions);
      deviceList.append(row);
    });
  };

  const refresh = async () => {
    try {
      const status = await request("/admin/api/status");
      const online = byId("connection");
      online.className = "connection online";
      online.lastChild.textContent = "온라인";
      byId("bridge-status").textContent = status.bridge && status.bridge.name ? status.bridge.name : "정상";
      byId("codex-status").textContent = status.codex && status.codex.loggedIn ? "로그인됨" : "로그인 필요";
      renderPending(status.pendingPairRequests || [], status.awaitingPairClaims || []);
      renderDevices(status.devices || []);
    } catch (error) {
      const offline = byId("connection");
      offline.className = "connection offline";
      offline.lastChild.textContent = "연결 오류";
      showNotice(error instanceof Error ? error.message : "상태를 불러오지 못했습니다.", true);
    }
  };

  createCode.addEventListener("click", () => runAction(createCode, async () => {
    const result = await request("/admin/api/pair-code", { method: "POST", body: "{}" });
    pairCode.textContent = result.code;
    pairExpiry.textContent = "만료 " + formatDate(result.expiresAt) + " · 코드를 누르면 복사됩니다.";
  }, "새 페어링 코드를 발급했습니다."));

  pairCode.addEventListener("click", async () => {
    if (!/^\\d{6}$/.test(pairCode.textContent || "")) return;
    try {
      await navigator.clipboard.writeText(pairCode.textContent);
      showNotice("코드를 복사했습니다.", false);
    } catch {
      showNotice("코드를 길게 눌러 복사해 주세요.", true);
    }
  });

  byId("refresh").addEventListener("click", refresh);
  refresh();
  setInterval(refresh, 5000);
})();
`;
