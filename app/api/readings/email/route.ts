import { handle, json, readJson } from "@/lib/http";
import { saveReadingEmail } from "@/lib/readings";

// 리포트 화면: 다시 보려면 이메일 저장 { id, key, email }
export const POST = handle(async (req) => {
  const b = await readJson(req);
  return json(await saveReadingEmail(String(b.id ?? ""), String(b.key ?? "").slice(0, 100), b.email));
});
