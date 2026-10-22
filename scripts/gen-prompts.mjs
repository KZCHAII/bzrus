// prompts/*.md → lib/prompts.generated.ts (배포 묶음에 프롬프트가 확실히 들어가도록 코드로 만든다)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "prompts");
const out = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) out[f.replace(/\.md$/, "")] = readFileSync(join(dir, f), "utf8");
const body = `// 자동 생성 파일: prompts/*.md를 고친 뒤 \`node scripts/gen-prompts.mjs\` (빌드 때 자동). 직접 고치지 말 것.\nexport const PROMPTS: Record<string, string> = ${JSON.stringify(out, null, 2)};\n`;
writeFileSync(join(root, "lib/prompts.generated.ts"), body);
console.log(`[prompts] ${Object.keys(out).length}개`);
