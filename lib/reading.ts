// 상세 리포트 신청 (결제 전 단계: 출시 알림 명단). 같은 이메일은 한 줄로 갱신.
import { getSql } from "./db";
import { HttpError, str } from "./http";
import { cleanName, hashIp, parseBirthday, publicSign } from "./maps";
import { signOf } from "./saju";

const REQUESTS_PER_IP_PER_DAY = 10;

export function cleanEmail(v: unknown): string {
  const e = str(v, 254).toLowerCase();
  if (!/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/.test(e)) throw new HttpError(400, "BAD_EMAIL", { error: "BAD_EMAIL", message: "Enter a valid email." });
  return e;
}

export async function requestReading(input: { email: unknown; name: unknown; birthday: unknown; time?: unknown; timeUnknown?: unknown; place?: unknown; gender?: unknown }, ip: string, isTest = false) {
  const email = cleanEmail(input.email);
  const name = cleanName(input.name, "your name");
  const timeUnknown = input.timeUnknown === true;
  const b = parseBirthday(input.birthday, timeUnknown ? "" : input.time);
  if (!timeUnknown && !b.time) throw new HttpError(400, "NEED_TIME", { error: "NEED_TIME", message: "Add your birth time, or check \"I don't know my birth time\"." });
  // 출생지는 받지 않는다 (사주는 출생지 없이 계산). 예전 화면이 보내면 저장만
  const place = str(input.place, 80).replace(/[\u0000-\u001f\u007f<>]/g, "").trim() || null;
  const g = str(input.gender, 10).toLowerCase();
  const gender = g === "woman" || g === "man" ? g : null;
  const sign = signOf(b);
  const sql = getSql();
  const ipHash = hashIp(ip);
  if (ipHash) {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from reading_requests where ip_hash = ${ipHash} and updated_at > now() - interval '1 day'`;
    if (n >= REQUESTS_PER_IP_PER_DAY) throw new HttpError(429, "TOO_MANY", { error: "TOO_MANY", message: "Too many requests today. Try again tomorrow." });
  }
  await sql`
    insert into reading_requests (email, name, birth_date, birth_time, time_unknown, birth_place, gender, sign_key, ip_hash, is_test)
    values (${email}, ${name}, ${b.iso}, ${b.time}, ${timeUnknown}, ${place}, ${gender}, ${sign.key}, ${ipHash}, ${isTest})
    on conflict (lower(email)) do update set
      name = excluded.name, birth_date = excluded.birth_date, birth_time = excluded.birth_time, time_unknown = excluded.time_unknown,
      birth_place = excluded.birth_place, gender = excluded.gender, sign_key = excluded.sign_key, ip_hash = excluded.ip_hash, updated_at = now()`;
  return { ok: true, sign: publicSign(sign) };
}
