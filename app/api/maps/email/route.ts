import { handle, json, readJson } from "@/lib/http";
import { saveMapEmail, siteBase } from "@/lib/account";

// 주인이 내 페이지에 이메일 저장 (x-owner-token 헤더)
export const POST = handle(async (req) => {
  const body = await readJson(req);
  return json(await saveMapEmail(String(body.slug ?? ""), (req.headers.get("x-owner-token") ?? "").slice(0, 100), body.email, siteBase(req)));
});
