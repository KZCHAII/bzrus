// 상세 리포트 신청: 시간·출생지 필수(시간 모름 선택 가능), 같은 이메일은 한 줄
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";
import { call, req } from "./helpers/req";
import { POST } from "@/app/api/reading/route";
import type { Sql } from "@/lib/db";

let sql: Sql, drop: () => Promise<void>;
beforeAll(async () => { ({ sql, drop } = await createTestDb()); });
afterAll(() => drop());
const base = { email: "Alex@Example.com", name: "Alex", birthday: "1992-03-15", time: "14:30", gender: "woman" };

it("신청하면 저장, 같은 이메일은 갱신", async () => {
  expect((await call(POST, req("/api/reading", { body: base }))).status).toBe(200);
  expect((await call(POST, req("/api/reading", { body: { ...base, email: "alex@example.com", time: "", timeUnknown: true } }))).status).toBe(200);
  const rows = await sql`select email, birth_time, time_unknown, birth_place, gender from reading_requests`;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ email: "alex@example.com", birth_time: null, time_unknown: true, birth_place: null, gender: "woman" });
});

it("시간·이메일 확인 (출생지는 안 받음)", async () => {
  const code = async (b: object) => (await call(POST, req("/api/reading", { body: { ...base, ...b }, ip: "198.51.100.9" }))).status;
  expect(await code({ time: "" })).toBe(400);           // 시간도 없고 '모름'도 안 고름
  expect(await code({ email: "b@c.co", place: undefined })).toBe(200);
  expect(await code({ email: "not-an-email" })).toBe(400);
  expect(await code({ email: "a@b.co", time: "25:00" })).toBe(400);
});
