// 이메일 = 열쇠: 페이지에 이메일 저장 → 다른 기기에서 링크 요청 → 링크 사용 → 그 기기가 주인 + 리포트 링크
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";
import { call, req } from "./helpers/req";
import { GET as getMap, POST as createMap } from "@/app/api/maps/route";
import { POST as saveEmail } from "@/app/api/maps/email/route";
import { POST as link } from "@/app/api/auth/link/route";
import { POST as redeem } from "@/app/api/auth/redeem/route";
import type { Sql } from "@/lib/db";

let sql: Sql, drop: () => Promise<void>;
beforeAll(async () => { ({ sql, drop } = await createTestDb()); });
afterAll(() => drop());

const tokenFrom = (body: string) => /#t=([A-Za-z0-9_-]+)/.exec(body)![1];
async function lastLoginMail(email: string) {
  const [m] = await sql`select body_text from email_outbox where kind = 'login' and to_email = ${email} order by created_at desc limit 1`;
  return m?.body_text as string | undefined;
}

describe("이메일 열쇠", () => {
  let slug = "", firstToken = "";
  it("주인만 페이지에 이메일 저장, 확인 메일 기록", async () => {
    const m = await call(createMap, req("/api/maps", { body: { name: "Alex", birthday: "1990-01-01" }, ip: "5.5.5.1" }));
    slug = m.data.slug; firstToken = m.data.ownerToken;
    const bad = await call(saveEmail, req("/api/maps/email", { body: { slug, email: "a@b.co" }, headers: { "x-owner-token": "nope" } }));
    expect(bad.status).toBe(403);
    const r = await call(saveEmail, req("/api/maps/email", { body: { slug, email: "Alex@Example.com" }, headers: { "x-owner-token": firstToken } }));
    expect(r.data).toEqual({ saved: true, email: "a***@example.com" });
    const [row] = await sql`select owner_email from maps where slug = ${slug}`;
    expect(row.owner_email).toBe("alex@example.com");
    expect((await sql`select count(*)::int n from email_outbox where kind = 'page_saved' and to_email = 'alex@example.com'`)[0].n).toBe(1);
    const v = await call(getMap, req(`/api/maps?slug=${slug}`, { method: "GET", headers: { "x-owner-token": firstToken } }));
    expect(v.data.savedEmail).toBe("a***@example.com");
    const guest = await call(getMap, req(`/api/maps?slug=${slug}`, { method: "GET" }));
    expect(guest.data.savedEmail).toBeUndefined();
  });

  it("연결 안 된 이메일: 응답은 같고 메일은 안 보냄", async () => {
    const r = await call(link, req("/api/auth/link", { body: { email: "nobody@example.com" }, ip: "5.5.5.2" }));
    expect(r.data).toEqual({ sent: true });
    expect(await lastLoginMail("nobody@example.com")).toBeUndefined();
  });

  it("링크 → 새 기기가 주인, 리포트 링크도 받음, 한 번만", async () => {
    await sql`insert into readings (view_key, email, name, birth_date, time_unknown, gender, sign_key, prompt_version, is_test)
              values ('vk_123', 'alex@example.com', 'Alex', '1990-01-01', true, 'man', 'k', 'v', true)`;
    expect((await call(link, req("/api/auth/link", { body: { email: "alex@example.com" }, ip: "5.5.5.3" }))).status).toBe(200);
    const body = await lastLoginMail("alex@example.com");
    expect(body).toMatch(/\/find#t=/);
    const t = tokenFrom(body!);
    // 토큰은 해시로만 저장
    expect((await sql`select count(*)::int n from login_links where token_hash = ${t}`)[0].n).toBe(0);
    const r = await call(redeem, req("/api/auth/redeem", { body: { token: t } }));
    expect(r.status).toBe(200);
    expect(r.data.maps).toEqual([{ slug, name: "Alex", ownerToken: expect.any(String) }]);
    expect(r.data.readings).toEqual([expect.objectContaining({ key: "vk_123", name: "Alex" })]);
    const newToken = r.data.maps[0].ownerToken;
    const asNew = await call(getMap, req(`/api/maps?slug=${slug}`, { method: "GET", headers: { "x-owner-token": newToken } }));
    expect(asNew.data.isOwner).toBe(true);
    const asOld = await call(getMap, req(`/api/maps?slug=${slug}`, { method: "GET", headers: { "x-owner-token": firstToken } }));
    expect(asOld.data.isOwner).toBe(true); // 처음 기기도 그대로
    expect((await call(redeem, req("/api/auth/redeem", { body: { token: t } }))).status).toBe(410);
  });

  it("30분 지나면 못 씀, 엉터리 토큰은 400", async () => {
    await call(link, req("/api/auth/link", { body: { email: "alex@example.com" }, ip: "5.5.5.4" }));
    const t = tokenFrom((await lastLoginMail("alex@example.com"))!);
    await sql`update login_links set expires_at = now() - interval '1 minute' where used_at is null`;
    expect((await call(redeem, req("/api/auth/redeem", { body: { token: t } }))).status).toBe(410);
    expect((await call(redeem, req("/api/auth/redeem", { body: { token: "x" } }))).status).toBe(400);
  });

  it("같은 이메일로 한 시간에 4번까지", async () => {
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await call(link, req("/api/auth/link", { body: { email: "spam@example.com" }, ip: `6.6.6.${i}` }))).status);
    expect(codes).toEqual([200, 200, 200, 200]);
    expect((await call(link, req("/api/auth/link", { body: { email: "spam@example.com" }, ip: "6.6.6.9" }))).status).toBe(429);
    expect((await call(link, req("/api/auth/link", { body: { email: "not-an-email" } }))).status).toBe(400);
  });
});
