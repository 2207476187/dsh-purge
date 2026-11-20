import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { dshBaseEnvStatus, missingAiBaseMessage } from "../lib/core.js";

// 一个"看起来像插件根"的目录：只要其下有 dsh-agent-instructions/lib 就算命中。
function makeBase(dir) {
  fs.mkdirSync(path.join(dir, "dsh-agent-instructions", "lib"), { recursive: true });
  return dir;
}

function withBase(base, fn) {
  const prev = process.env.DSH_BASE;
  if (base === undefined) delete process.env.DSH_BASE;
  else process.env.DSH_BASE = base;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.DSH_BASE;
    else process.env.DSH_BASE = prev;
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-purge-test-"));
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

test("合法插件根被接受", () => {
  const base = makeBase(path.join(tmpRoot, "ok"));
  withBase(base, () => {
    const st = dshBaseEnvStatus();
    assert.equal(st.set, true);
    assert.equal(st.valid, true);
    assert.equal(st.leftover, false);
  });
});

test("构建残留目录被拒绝并标记为 leftover", () => {
  const base = makeBase(path.join(tmpRoot, ".browser-build-tmp", "dsh-browser-abc"));
  withBase(base, () => {
    const st = dshBaseEnvStatus();
    assert.equal(st.set, true);
    assert.equal(st.valid, false, "构建残留目录不应被当成插件根");
    assert.equal(st.leftover, true);
    assert.match(missingAiBaseMessage(), /构建残留目录/);
  });
});

test("_archive 同样被拒绝", () => {
  const base = makeBase(path.join(tmpRoot, "_archive", "old"));
  withBase(base, () => {
    assert.equal(dshBaseEnvStatus().leftover, true);
  });
});

test("路径存在但不是插件根时不标记 leftover", () => {
  const dir = path.join(tmpRoot, "not-a-base");
  fs.mkdirSync(dir, { recursive: true });
  withBase(dir, () => {
    const st = dshBaseEnvStatus();
    assert.equal(st.valid, false);
    assert.equal(st.leftover, false);
    assert.match(missingAiBaseMessage(), /不是有效的插件根/);
  });
});

test("未设置 DSH_BASE 时返回 set:false 而不是抛错", () => {
  withBase(undefined, () => {
    const st = dshBaseEnvStatus();
    assert.equal(st.set, false);
    assert.equal(st.valid, false);
  });
});
