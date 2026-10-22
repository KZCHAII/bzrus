import { handle, json, readJson } from "@/lib/http";
import { parseBirthday, publicSign } from "@/lib/maps";
import { signOf } from "@/lib/saju";

// 생일 → 별자리 + Korean sign (DB 저장 없음)
export const POST = handle(async (req) => {
  const body = await readJson(req);
  const b = parseBirthday(body.birthday, body.time);
  return json({ sign: publicSign(signOf(b)) });
});
