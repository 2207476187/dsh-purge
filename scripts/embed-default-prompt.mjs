import fs from "node:fs";
import path from "node:path";
import { createDecipheriv } from "node:crypto";
import { inflateSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mixKey, sealSlot } from "../lib/table-key.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, "lib", "default-prompt-inject.md");
const dest = path.join(root, "lib", "asset-table.js");
const rel = (p) => path.relative(root, p).replace(/\\/g, "/");

if (!fs.existsSync(src)) {
  throw new Error([
    `缺构建输入: ${rel(src)}`,
    "",
    "这是被封装进 lib/asset-table.js 的提示词明文源，属于构建输入（不是产物），应当随仓库提供。",
    "若这份副本里没有，说明检出方式把它漏了，补回来即可：",
    `  git show HEAD:${rel(src)} > ${rel(src)}`,
    "",
    "注意：不要用 default-prompt-inject.zh.md / .en.md 顶替。那是另外两套改写版",
    "（278 / 284 行，章节结构不同），封装后会静默把默认提示词换成另一套内容。",
  ].join("\n"));
}

const text = fs.readFileSync(src, "utf8");
if (!text.trim()) throw new Error(`local source is empty: ${rel(src)}`);

const packed = sealSlot(text);
const chunk = (s, n = 96) => {
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
};

const out = `const SLOT_ROWS = ${JSON.stringify(chunk(packed.SLOT), null, 2)};

export const SLOT = SLOT_ROWS.join("");
export const MASK = ${JSON.stringify(packed.MASK)};
export const TAG = ${JSON.stringify(packed.TAG)};
export const IV = ${JSON.stringify(packed.IV)};
`;

fs.writeFileSync(dest, out, "utf8");

// 自检：openSlot() 会把解密异常吞成空串，写坏了不报错，只能在这里拦住。
const written = await import(`${pathToFileURL(dest).href}?v=${Date.now()}`);
const decipher = createDecipheriv("aes-256-gcm", mixKey(written.MASK), Buffer.from(written.IV, "base64"));
decipher.setAuthTag(Buffer.from(written.TAG, "base64"));
const round = inflateSync(Buffer.concat([
  decipher.update(Buffer.from(written.SLOT, "base64")),
  decipher.final(),
])).toString("utf8");
if (round !== text) {
  throw new Error(`封装自检失败：解密结果与 ${rel(src)} 不一致。${rel(dest)} 已写出，请勿提交。`);
}

process.stdout.write(`wrote ${rel(dest)} bytes=${text.length} selfcheck=ok\n`);
