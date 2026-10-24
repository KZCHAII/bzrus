import { handle, json } from "@/lib/http";
import { requireCron } from "@/lib/admin";
import { background } from "@/lib/background";
import { sweepReadings } from "@/lib/readings";

// 5분마다: 결제 후 멈춘 리포트·카드를 다시 돌린다 — vercel.json crons
export const maxDuration = 300;

export const GET = handle(async (req) => {
  requireCron(req);
  return json(await sweepReadings(background));
});
