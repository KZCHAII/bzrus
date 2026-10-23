import { handle, json } from "@/lib/http";
import { background } from "@/lib/background";
import { handleLsWebhook } from "@/lib/payments";

// Lemon Squeezy 웹훅 (order_created, order_refunded). 본문을 그대로 읽어 서명 확인
export const maxDuration = 300;
export const POST = handle(async (req) => {
  const raw = await req.text();
  return json(await handleLsWebhook(raw, req.headers.get("x-signature") ?? "", background));
});
