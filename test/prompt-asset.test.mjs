import test from "node:test";
import assert from "node:assert/strict";
import { openSlot } from "../lib/table-read.js";

// openSlot() 内部 catch 掉所有异常返回空串，所以“能不能解开”必须单独断言，
// 否则密文写坏了也只是默认提示词悄悄变空。
const slot = openSlot();

test("加密槽可解密且非空", () => {
  assert.ok(slot.trim().length > 1000, `openSlot() 返回 ${slot.length} 字符，封装可能已损坏`);
});

test("默认提示词保留血统标记（丢失会被误判成用户自改，从此不再随槽更新）", () => {
  for (const mark of ["<|im_start|>system:", "<project_instructions>", "Little Code Sauce"]) {
    assert.ok(slot.includes(mark), `缺少血统标记: ${mark}`);
  }
});

test("工作流是「先给结论再动手」，没有回退到先执行", () => {
  assert.match(slot, /Lead with the conclusion before touching anything/);
  assert.ok(
    !/Execute first \(tools, commands, code, edits, writing\)/.test(slot),
    "旧工作流句子又回来了",
  );
});

test("默认提示词不是中文改写版（防止误把 .zh.md 封进来）", () => {
  assert.ok(
    !/不以解释、免责声明、范围检查或权限谈话开头/.test(slot),
    "槽内是 default-prompt-inject.zh.md 的内容，说明封装时用错了源文件",
  );
});
