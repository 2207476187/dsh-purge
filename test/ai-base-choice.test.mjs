import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { aiBaseIsDshHomeStray } from "../lib/core.js";

const home = "C:\\Users\\tester\\.dsh";
const join = (...parts) => path.join(home, ...parts);

test("构建残树被判为走神目录", () => {
  assert.equal(aiBaseIsDshHomeStray(join("dsh-browser", "node_modules", ".pnpm", "node_modules", "@deepseek-ai"), home), true);
  assert.equal(aiBaseIsDshHomeStray(join("dsh-builtin-browser-host", "node_modules", "@deepseek-ai"), home), true);
});

test("便携版安装不算走神（DSH_HOME 下直接就是 node_modules）", () => {
  assert.equal(aiBaseIsDshHomeStray(join("node_modules", "@deepseek-ai"), home), false);
  assert.equal(aiBaseIsDshHomeStray(join("node_modules", ".pnpm", "node_modules", "@deepseek-ai"), home), false);
});

test("任何 profile 都不算走神", () => {
  assert.equal(aiBaseIsDshHomeStray(join("profiles", "desktop", "node_modules", "@deepseek-ai"), home), false);
  assert.equal(aiBaseIsDshHomeStray(join("profiles", "web", "node_modules", "@deepseek-ai"), home), false);
});

test("DSH_HOME 之外的路径一律不算走神", () => {
  assert.equal(aiBaseIsDshHomeStray("X:\\Program Files\\DeepSeek Harness\\resources\\app\\dsh\\node_modules\\@deepseek-ai", home), false);
  assert.equal(aiBaseIsDshHomeStray("/usr/lib/node_modules/@deepseek-ai", home), false);
});

test("边界输入不抛错", () => {
  assert.equal(aiBaseIsDshHomeStray("", home), false);
  assert.equal(aiBaseIsDshHomeStray(null, home), false);
  assert.equal(aiBaseIsDshHomeStray(join("dsh-browser"), ""), false);
  assert.equal(aiBaseIsDshHomeStray(home, home), false, "DSH_HOME 自身没有相对段");
});

test("大小写与斜杠混用同样判定", () => {
  assert.equal(aiBaseIsDshHomeStray("C:/USERS/TESTER/.DSH/dsh-browser/node_modules/@deepseek-ai", home), true);
  assert.equal(aiBaseIsDshHomeStray("c:\\users\\tester\\.dsh\\profiles\\desktop\\node_modules\\@deepseek-ai", home), false);
});

test("同名前缀但不同目录不算（防 startsWith 误判）", () => {
  const sibling = "C:\\Users\\tester\\.dsh-old\\dsh-browser\\node_modules\\@deepseek-ai";
  assert.equal(aiBaseIsDshHomeStray(sibling, home), false);
});
