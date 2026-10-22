import { handle, json, readJson } from "@/lib/http";
import { clientIp } from "@/lib/maps";
import { background } from "@/lib/background";
import { createReading, viewReading } from "@/lib/readings";

// 리포트 생성(AI 1~2분)이 응답 뒤에도 끝까지 돌도록
export const maxDuration = 300;

// 상세 리포트 만들기 (지금은 test 모드에서만; 결제 연결 뒤 paid)
export const POST = handle(async (req) => {
  const b = await readJson(req);
  return json(await createReading({ name: b.name, birthday: b.birthday, time: b.time, timeUnknown: b.timeUnknown, gender: b.gender, email: b.email }, clientIp(req), background));
});

// 보기 ?id=&k=
export const GET = handle(async (req) => {
  const q = new URL(req.url).searchParams;
  return json(await viewReading(q.get("id") ?? "", (q.get("k") ?? "").slice(0, 100), background));
});
