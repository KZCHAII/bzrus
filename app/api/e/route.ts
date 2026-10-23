import { handle, json, readJson } from "@/lib/http";
import { trackClient } from "@/lib/events";

// 화면 이벤트 (쿠키 없음, 정해진 이름만)
export const POST = handle(async (req) => json(await trackClient(req, await readJson(req))));
