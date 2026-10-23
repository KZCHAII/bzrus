import { handle, json } from "@/lib/http";
import { requireCron } from "@/lib/admin";
import { dailyDigest } from "@/lib/digest";

// 매일 아침 9시(한국) 텔레그램 요약 — vercel.json crons
export const GET = handle(async (req) => {
  requireCron(req);
  return json(await dailyDigest());
});
