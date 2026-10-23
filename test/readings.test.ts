// 상세 리포트: 모드·상한, 생성(가짜 AI) → 카드, 보기 키, 멈춘 생성 다시 시작, 실패 처리
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";
import { call, req } from "./helpers/req";
import { setServices } from "@/lib/services";
import { buildPrompt, createReading, generateReading, viewReading } from "@/lib/readings";
import { GET as modeRoute } from "@/app/api/readings/mode/route";
import type { Sql } from "@/lib/db";

let sql: Sql, drop: () => Promise<void>;
beforeAll(async () => { ({ sql, drop } = await createTestDb()); });
afterAll(() => drop());
afterEach(() => { delete process.env.READINGS_MODE; delete process.env.TEST_DAILY_CAP; setServices(null); });

const REPORT = `##Strategic Destiny Report
This report is a data asset.

##Your Core Design: Temperament and Wiring
${"You decide fast and you do not wait for permission. ".repeat(20)}

##Looking Back: 2021-2025
2021 was a year of change. ${"You moved and rebuilt. ".repeat(20)}

##Final Recommendation
Keep the speed, add one pause.

##(You don't have to win every room.)`;
const CARDS = JSON.stringify({
  core: { headline: "Speed is your edge", body: "You act first.", strength: { title: "Fast", desc: "You move." }, caution: { title: "Pause", desc: "Slow down." } },
  sections: [
    { heading: "Your Core Design: Temperament and Wiring", kind: "points", summary: "Fast.", points: [{ title: "A", desc: "B" }], timeline: [], qa: [], highlight: "You decide fast and you do not wait for permission." },
    { heading: "Made Up Section", kind: "points", summary: "x", points: [], timeline: [], qa: [], highlight: "" },
  ],
  final: { conclusion: "Keep the speed.", last_line: "You don't have to win every room." },
  cycle: { theme: "Pressure that builds status", areas: [{ area: "Work", score: 9, note: "Big push." }, { area: "Bogus", score: 2, note: "x" }] },
  fit: { summary: "Calm planners.", traits: [{ title: "Patient", desc: "Slows you down." }], avoid: "Constant critics." },
});
const calls: string[] = [];
const fakeAi = (fail = 0) => {
  let n = 0;
  return { generate: async (_m: string, prompt: string, o?: { schema?: object }) => {
    calls.push(o?.schema ? "cards" : "report");
    if (!o?.schema && n++ < fail) throw new Error("GEMINI_500:boom");
    return o?.schema ? CARDS : REPORT;
  } };
};
const input = { name: "Alex", birthday: "1992-03-15", time: "14:30", gender: "woman", email: "alex@example.com" };
const jobs: Promise<unknown>[] = [];
const bg = (fn: () => Promise<unknown>) => { jobs.push(fn()); };
const flush = async () => { while (jobs.length) await jobs.shift(); };

describe("모드", () => {
  it("기본은 예약만: 만들기 막힘", async () => {
    expect((await call(modeRoute, req("/api/readings/mode"))).data.mode).toBe("reserve");
    await expect(createReading(input, "1.1.1.1", bg)).rejects.toMatchObject({ status: 403 });
  });
});

describe("test 모드 생성", () => {
  it("만들기 → 글 → 카드, 지어낸 섹션은 버림", async () => {
    process.env.READINGS_MODE = "test";
    setServices({ ai: fakeAi() });
    const { id, key } = await createReading(input, "1.1.1.1", bg);
    await flush();
    const v = await viewReading(id, key, bg);
    await flush();
    const v2 = await viewReading(id, key, bg);
    expect(v.status).toBe("done");
    expect(v2).toMatchObject({ status: "done", cards: { core: { headline: "Speed is your edge" } } });
    if (v2.status !== "done") throw 0;
    expect(v2.cards!.sections.map((s) => s.heading)).toEqual(["Your Core Design: Temperament and Wiring"]);
    expect(v2.chart.pillars.day.han).toBe("庚寅");
    expect(v2.cards!.cycle).toEqual({ theme: "Pressure that builds status", areas: [{ area: "Work", score: 5, note: "Big push." }] });
    expect(v2.chart.match.signs.length).toBeGreaterThan(0);
    expect(v2.chart.current?.cycle.startAge).toBeLessThanOrEqual(34);
    const [row] = await sql`select is_test, prompt_version from readings where id = ${id}`;
    expect(row.is_test).toBe(true);    // 다 쓰면 "Your reading is ready" 메일 (테스트 모드: 보내지 않고 기록만)
    const mails = await sql`select kind, to_email, status, body_text from email_outbox where kind = 'reading_ready' and body_text like ${"%/r/" + id + "?k=%"}`;
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to_email: "alex@example.com", status: "test" });
  });

  it("키가 틀리면 못 봄", async () => {
    process.env.READINGS_MODE = "test";
    setServices({ ai: fakeAi() });
    const { id } = await createReading(input, "1.1.1.2", bg);
    await flush();
    await expect(viewReading(id, "wrong", bg)).rejects.toMatchObject({ status: 404 });
    await expect(viewReading(id, "", bg)).rejects.toMatchObject({ status: 404 });
  });

  it("성별·시간 확인", async () => {
    process.env.READINGS_MODE = "test";
    await expect(createReading({ ...input, gender: "" }, "1.1.1.3", bg)).rejects.toMatchObject({ status: 400 });
    await expect(createReading({ ...input, email: "" }, "1.1.1.3", bg)).rejects.toMatchObject({ status: 400, code: "NEED_EMAIL" });
    await expect(createReading({ ...input, time: "" }, "1.1.1.3", bg)).rejects.toMatchObject({ status: 400 });
  });

  it("AI 실패 → 다음 보기 때 다시, 3번 실패면 failed", async () => {
    process.env.READINGS_MODE = "test";
    setServices({ ai: fakeAi(99) });
    const { id, key } = await createReading({ ...input, timeUnknown: true, time: "" }, "1.1.1.4", bg);
    await flush();
    expect((await sql`select status, attempts from readings where id = ${id}`)[0]).toMatchObject({ status: "generating", attempts: 1 });
    await viewReading(id, key, bg); await flush();
    await viewReading(id, key, bg); await flush();
    expect((await sql`select status, attempts from readings where id = ${id}`)[0]).toMatchObject({ status: "failed", attempts: 3 });
    expect((await viewReading(id, key, bg)).status).toBe("failed");
  });

  it("두 번 동시에 돌려도 한 번만 생성", async () => {
    process.env.READINGS_MODE = "test";
    setServices({ ai: fakeAi() });
    const { id } = await createReading(input, "1.1.1.5", () => {});
    calls.length = 0;
    await Promise.all([generateReading(id), generateReading(id)]);
    expect(calls.filter((c) => c === "report")).toHaveLength(1);
  });

  it("상한: 같은 IP 하루 3번, 전체 하루 상한", async () => {
    process.env.READINGS_MODE = "test";
    setServices({ ai: fakeAi() });
    process.env.TEST_DAILY_CAP = "100";
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) codes.push(await createReading(input, "7.7.7.7", () => {}).then(() => 200, (e) => e.status));
    expect(codes).toEqual([200, 200, 200, 429]);
    process.env.TEST_DAILY_CAP = "1";
    await expect(createReading(input, "8.8.8.8", () => {})).rejects.toMatchObject({ status: 429 });
  });
});

describe("프롬프트", () => {
  it("계산된 원국과 연도가 들어가고 빈 칸이 없다", () => {
    const { prompt } = buildPrompt({ name: "Alex", birth_date: "1992-03-15", birth_time: "14:30", gender: "woman" }, new Date("2026-10-22T12:00:00Z"));
    expect(prompt).toContain("Day pillar (the self; the branch is the partner palace): 庚寅");
    expect(prompt).toContain("##Looking Back: 2021-2025");
    expect(prompt).toContain("##The Next Five Years: 2026-2030");
    expect(prompt).toContain("##Your Current 10-Year Cycle: Ages 33-42");
    expect(prompt).toContain("Recommended Korean signs:");
    expect(prompt).toContain("Today is October 22, 2026");
    expect(prompt).not.toMatch(/\{\{\w+\}\}/);
    expect(prompt).not.toContain("<!--");
  });
});
