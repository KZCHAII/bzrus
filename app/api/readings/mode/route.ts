import { handle, json } from "@/lib/http";
import { readingsMode } from "@/lib/readings";

// 화면이 "바로 만들기 / 예약" 중 무엇을 보여 줄지
export const GET = handle(async () => json({ mode: readingsMode() }));
