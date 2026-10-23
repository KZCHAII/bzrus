import { handle, json, readJson } from "@/lib/http";
import { redeemLogin } from "@/lib/account";

// 메일 속 링크(#t=)를 이 기기에서 사용: 페이지 열쇠 + 리포트 링크를 돌려준다
export const POST = handle(async (req) => {
  const body = await readJson(req);
  return json(await redeemLogin(body.token));
});
