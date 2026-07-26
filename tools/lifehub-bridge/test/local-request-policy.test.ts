import assert from "node:assert/strict";
import test from "node:test";
import {
  allowsLocalBrowserConnection,
  isLoopbackBrowserOrigin,
  isLoopbackHostHeader,
  isLoopbackSocketAddress,
} from "../src/local-request-policy.js";

test("로컬 브라우저 연결 정책은 socket peer, Host, Origin을 모두 엄격히 확인한다", () => {
  assert.equal(isLoopbackSocketAddress("127.0.0.1"), true);
  assert.equal(isLoopbackSocketAddress("::ffff:127.0.0.1"), true);
  assert.equal(isLoopbackSocketAddress("::1"), true);
  assert.equal(isLoopbackSocketAddress("127.0.0.2"), false);
  assert.equal(isLoopbackSocketAddress("192.168.0.2"), false);

  for (const host of ["localhost", "LOCALHOST:4317", "127.0.0.1:4317", "[::1]:4317"]) {
    assert.equal(isLoopbackHostHeader(host), true, host);
  }
  for (const host of [undefined, "localhost.evil", "localhost#evil", "localhost/path", "127.0.0.2", "[::1]:0", "[::1]:65536"]) {
    assert.equal(isLoopbackHostHeader(host), false, String(host));
  }

  for (const origin of ["http://localhost:5173", "https://127.0.0.1", "http://[::1]:5173"]) {
    assert.equal(isLoopbackBrowserOrigin(origin), true, origin);
  }
  for (const origin of [undefined, "null", "file://localhost", "http://localhost.evil", "http://localhost/path", "http://user@localhost"]) {
    assert.equal(isLoopbackBrowserOrigin(origin), false, String(origin));
  }

  const direct = {
    remoteAddress: "127.0.0.1",
    host: "127.0.0.1:4317",
    origin: "http://localhost:5173",
  };
  assert.equal(allowsLocalBrowserConnection(direct), true);
  assert.equal(allowsLocalBrowserConnection({ ...direct, remoteAddress: "192.168.0.2" }), false);
  assert.equal(allowsLocalBrowserConnection({ ...direct, host: "bridge.example" }), false);
  assert.equal(allowsLocalBrowserConnection({ ...direct, origin: "https://app.example" }), false);
  assert.equal(allowsLocalBrowserConnection({ ...direct, hasForwardedHeaders: true }), false);
});
