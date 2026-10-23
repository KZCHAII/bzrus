import { handle, json } from "@/lib/http";
import { readingsMode } from "@/lib/readings";
import { lsConfig } from "@/lib/lemon";

// 화면이 "무료 시험 / 결제 / 예약" 중 무엇을 보여 줄지. paid인데 결제 설정이 없으면 예약으로
export const GET = handle(async () => {
  const m = readingsMode();
  const c = m === "paid" ? lsConfig() : null;
  return json({ mode: m === "paid" && !c ? "reserve" : m, ...(c ? { testPayments: c.testMode } : {}) });
});
