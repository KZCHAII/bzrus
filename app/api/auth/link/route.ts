import { handle, json, readJson } from "@/lib/http";
import { clientIp } from "@/lib/maps";
import { requestLogin, siteBase } from "@/lib/account";

// "Find my page": 이메일로 한 번 쓰는 링크 보내기 (연결된 게 있을 때만 실제로 보냄, 응답은 늘 같음)
export const POST = handle(async (req) => {
  const body = await readJson(req);
  return json(await requestLogin(body.email, clientIp(req), siteBase(req)));
});
