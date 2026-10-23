// 관리자 확인: ADMIN_KEY (사장님이 Vercel에 넣는 값). 없으면 관리자 기능은 잠김.
import { timingSafeEqual } from "node:crypto";
import { envOptional } from "./env";
import { HttpError } from "./http";

export function requireAdmin(req: Request) {
  const want = envOptional("ADMIN_KEY");
  const got = (req.headers.get("x-admin-key") ?? "").slice(0, 200);
  if (!want || want.length < 12) throw new HttpError(503, "ADMIN_OFF", { error: "ADMIN_OFF", message: "Admin is not set up yet (ADMIN_KEY)." });
  const a = Buffer.from(want), b = Buffer.from(got);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, "NOT_ADMIN", { error: "NOT_ADMIN", message: "Wrong key." });
}

/** Vercel 크론 호출 확인: CRON_SECRET 이 있으면 그 값, 없으면 Vercel 크론 표시 */
export function requireCron(req: Request) {
  const secret = envOptional("CRON_SECRET");
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "NOT_CRON");
    return;
  }
  if (!(req.headers.get("user-agent") ?? "").startsWith("vercel-cron/")) throw new HttpError(401, "NOT_CRON");
}
