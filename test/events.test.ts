// 통계: 화면 이벤트(정해진 이름만, IP 안 남김) → 관리자 통계(열쇠) → 매일 요약(크론만)
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";
import { call, req } from "./helpers/req";
import { POST as ev } from "@/app/api/e/route";
import { GET as adminStats } from "@/app/api/admin/stats/route";
import { GET as cron } from "@/app/api/cron/daily/route";
import { POST as createMap } from "@/app/api/maps/route";
import type { Sql } from "@/lib/db";

let sql: Sql, drop: () => Promise<void>;
beforeAll(async () => { ({ sql, drop } = await createTestDb()); });
afterAll(() => drop());
afterEach(() => { delete process.env.ADMIN_KEY; delete process.env.CRON_SECRET; });

describe("통계", () => {
  it("정해진 이름만 받고, IP는 남기지 않는다", async () => {
    expect((await call(ev, req("/api/e", { body: { n: "page_view", p: "landing", s: "instagram.com" }, ip: "198.51.100.9" }))).data).toEqual({ ok: true });
    expect((await call(ev, req("/api/e", { body: { n: "drop_table" } }))).data).toEqual({ ok: false });
    const rows = await sql`select * from events`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "page_view", page: "landing", src: "instagram.com" });
    expect(rows[0].visitor).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(rows)).not.toContain("198.51.100.9");
  });

  it("관리자 통계는 열쇠가 있어야", async () => {
    await call(createMap, req("/api/maps", { body: { name: "Alex", birthday: "1990-01-01" }, ip: "198.51.100.10" }));
    expect((await call(adminStats, req("/api/admin/stats"))).status).toBe(503);
    process.env.ADMIN_KEY = "correct-horse-battery";
    expect((await call(adminStats, req("/api/admin/stats", { headers: { "x-admin-key": "wrong" } }))).status).toBe(401);
    const r = await call(adminStats, req("/api/admin/stats?days=7", { headers: { "x-admin-key": "correct-horse-battery" } }));
    expect(r.status).toBe(200);
    expect(r.data.days).toHaveLength(7);
    expect(r.data.days[0]).toMatchObject({ visitors: 1, maps: 1 });
    expect(r.data.totals.maps).toBe(1);
    expect(r.data.sources).toEqual([{ src: "instagram.com", visitors: 1 }]);
  });

  it("매일 요약은 Vercel 크론만", async () => {
    expect((await call(cron, req("/api/cron/daily"))).status).toBe(401);
    expect((await call(cron, req("/api/cron/daily", { headers: { "user-agent": "vercel-cron/1.0" } }))).status).toBe(200);
    process.env.CRON_SECRET = "s3cret-value";
    expect((await call(cron, req("/api/cron/daily", { headers: { "user-agent": "vercel-cron/1.0" } }))).status).toBe(401);
    expect((await call(cron, req("/api/cron/daily", { headers: { authorization: "Bearer s3cret-value" } }))).status).toBe(200);
  });
});

describe("관리자 열쇠: 한글·공백", () => {
  it("한글 열쇠도, 앞뒤 공백이 붙어 있어도 열린다", async () => {
    process.env.ADMIN_KEY = " 별자리위드사주2026통계\n";
    const ok = await call(adminStats, req("/api/admin/stats", { headers: { "x-admin-key": encodeURIComponent("별자리위드사주2026통계 ") } }));
    expect(ok.status).toBe(200);
    expect((await call(adminStats, req("/api/admin/stats", { headers: { "x-admin-key": encodeURIComponent("별자리") } }))).status).toBe(401);
  });
});
