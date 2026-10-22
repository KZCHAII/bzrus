import { handle, json, readJson } from "@/lib/http";
import { clientIp } from "@/lib/maps";
import { requestReading } from "@/lib/reading";

// 상세 리포트 신청 (결제 열리기 전: 출시 알림 명단)
export const POST = handle(async (req) => {
  const b = await readJson(req);
  return json(await requestReading({ email: b.email, name: b.name, birthday: b.birthday, time: b.time, timeUnknown: b.timeUnknown, place: b.place }, clientIp(req)));
});
