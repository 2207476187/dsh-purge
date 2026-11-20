import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { locateDesktopInstall, exeFromRegistry, isAsarSealedPath } from "../lib/desktop.js";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-purge-desktop-"));
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

/** 造一棵最小安装树：exe + resources/app.asar，宿主包「密封」在里面。 */
function makeInstall(name, { unpacked = false } = {}) {
  const installDir = path.join(tmpRoot, name);
  const resources = path.join(installDir, "resources");
  fs.mkdirSync(resources, { recursive: true });
  const exe = path.join(installDir, "DeepSeek Harness.exe");
  fs.writeFileSync(exe, "");
  fs.writeFileSync(path.join(resources, "app.asar"), "not a real asar");
  if (unpacked) {
    fs.mkdirSync(
      path.join(resources, "app", "dsh", "node_modules", "@deepseek-ai", "dsh-agent-instructions", "lib"),
      { recursive: true },
    );
  }
  return { installDir, resources, exe };
}

const probe = (exe) => locateDesktopInstall({ execPath: exe, resourcesPath: "", argv: [], env: {} });

test("密封宿主：定位到安装，但 patchable 为空", () => {
  const { installDir, resources, exe } = makeInstall("sealed");
  const info = probe(exe);
  assert.equal(info.exe, exe);
  assert.equal(info.installDir, installDir);
  assert.equal(info.resources, resources);
  assert.equal(info.asar, path.join(resources, "app.asar"));
  assert.equal(info.sealed, true, "有 app.asar 又没有散装包 → 密封");
  assert.deepEqual(info.patchable, []);
});

test("已解包宿主：patchable 非空且不再判为密封", () => {
  const { resources, exe } = makeInstall("unpacked", { unpacked: true });
  const info = probe(exe);
  assert.equal(info.sealed, false);
  assert.equal(info.patchable.length, 1);
  assert.equal(
    info.patchable[0],
    path.join(resources, "app", "dsh", "node_modules", "@deepseek-ai"),
  );
});

test("没有 app.asar 时不算密封", () => {
  const { resources, exe } = makeInstall("no-asar");
  fs.rmSync(path.join(resources, "app.asar"));
  const info = probe(exe);
  assert.equal(info.asar, "");
  assert.equal(info.sealed, false);
});

test("找不到安装时字段齐全，不返回 null", () => {
  const info = locateDesktopInstall({
    execPath: path.join(tmpRoot, "missing", "x.exe"),
    resourcesPath: "",
    argv: [],
    env: {},
  });
  assert.notEqual(info, null);
  for (const key of ["exe", "installDir", "resources", "asar", "sealed", "patchable", "via_registry"]) {
    assert.ok(key in info, `缺少字段 ${key}`);
  }
  assert.ok(Array.isArray(info.patchable));
});

test("exeFromRegistry 总是返回字符串（非 Windows 为空）", () => {
  assert.equal(typeof exeFromRegistry(), "string");
  if (process.platform !== "win32") assert.equal(exeFromRegistry(), "");
});

test("app.asar 本身不算「内部路径」，其子路径才算", () => {
  const asar = path.join(tmpRoot, "i", "resources", "app.asar");
  assert.equal(isAsarSealedPath(asar), false, "asar 文件本身要能被当文件读");
  assert.equal(isAsarSealedPath(path.join(asar, "dsh", "index.js")), true);
  assert.equal(isAsarSealedPath(asar + ".unpacked/dsh/index.js"), false);
});
