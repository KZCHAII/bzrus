import { handle, json } from "@/lib/http";
import { requireAdmin } from "@/lib/admin";
import { stats } from "@/lib/events";

// 관리자 통계 ?days=7 (x-admin-key 헤더)
export const GET = handle(async (req) => {
  requireAdmin(req);
  const days = Math.max(1, Math.min(60, Number(new URL(req.url).searchParams.get("days")) || 7));
  return json(await stats(days));
});
