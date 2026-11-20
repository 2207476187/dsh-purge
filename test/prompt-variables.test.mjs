import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// dsh 0.2.1 起提示词变量只剩 provider / model。任何进 system prompt 的文本里出现 {{cwd}}，
// 组装时都会抛 unknown prompt variable，整轮直接失败。这条测试守的是「别再写回去」。
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("bundle patch 不再向 personaSuffix 写 {{cwd}}", () => {
  const yml = fs.readFileSync(path.join(root, "cordis.patch.yml"), "utf8");
  const lines = yml.split(/\r?\n/).filter((line) => /^\s*personaSuffix:/.test(line));
  assert.ok(lines.length > 0, "bundle patch 应该显式声明 personaSuffix");
  for (const line of lines) {
    assert.ok(!line.includes("{{"), `personaSuffix 不能带提示词变量: ${line.trim()}`);
  }
});

test("identity overlay 注入的 suffix 文本不含变量", () => {
  const src = fs.readFileSync(path.join(root, "lib", "identity.js"), "utf8");
  const hit = src.match(/const SUFFIX_TEXT = "([^"]*)"/);
  assert.ok(hit, "identity.js 应定义 SUFFIX_TEXT");
  assert.ok(!hit[1].includes("{{"), `SUFFIX_TEXT 不能带变量: ${hit[1]}`);
});

test("写回 section 的文本只用 SUFFIX_TEXT，不再用 CWD_ONLY_SUFFIX", () => {
  const src = fs.readFileSync(path.join(root, "lib", "identity.js"), "utf8");
  assert.ok(
    !/text:\s*CWD_ONLY_SUFFIX/.test(src),
    "CWD_ONLY_SUFFIX 只用于识别旧文本，不能作为注入内容",
  );
});
