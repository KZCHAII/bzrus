// 친구 지도 흐름: 만들기 → 친구 올리기(동의) → 주인/손님 보기 → 지우기, 그리고 막아야 할 것들
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";
import { call, req } from "./helpers/req";
import { POST as sign } from "@/app/api/sign/route";
import { GET as getMap, POST as createMap } from "@/app/api/maps/route";
import { DELETE as delEntry, POST as addEntry } from "@/app/api/maps/entries/route";
import type { Sql } from "@/lib/db";

let sql: Sql, drop: () => Promise<void>;
beforeAll(async () => { ({ sql, drop } = await createTestDb()); });
afterAll(() => drop());

describe("sign", () => {
  it("생일 → 별자리 + Korean sign, 저장 없음", async () => {
    const r = await call(sign, req("/api/sign", { body: { birthday: "1996-11-21" } }));
    expect(r.status).toBe(200);
    expect(r.data.sign).toMatchObject({ name: "Winter Ocean", hanja: "壬", zodiac: "Scorpio" });
    expect((await sql`select count(*)::int n from maps`)[0].n).toBe(0);
  });
  it("시간을 넣으면 네 기둥, 안 넣으면 시주 없음", async () => {
    const withT = await call(sign, req("/api/sign", { body: { birthday: "1996-11-21", time: "14:30" } }));
    expect(withT.data.sign.pillars.hour).toMatchObject({ han: expect.stringMatching(/^.{2}$/) });
    expect(withT.data.sign.pillars.day.han).toBe("壬戌");
    const noT = await call(sign, req("/api/sign", { body: { birthday: "1996-11-21" } }));
    expect(noT.data.sign.pillars.hour).toBeNull();
    for (const t of ["24:00", "9:5", "noon"]) expect((await call(sign, req("/api/sign", { body: { birthday: "1996-11-21", time: t } }))).status, t).toBe(400);
  });
  it("잘못된 생일", async () => {
    for (const b of ["1996-02-30", "abc", "1800-01-01", "2999-01-01", ""]) {
      expect((await call(sign, req("/api/sign", { body: { birthday: b } }))).status, b).toBe(400);
    }
  });
});

describe("지도", () => {
  let slug = "", token = "";
  it("만들기: 링크와 주인 토큰 (토큰은 해시로만 저장)", async () => {
    const r = await call(createMap, req("/api/maps", { body: { name: "  Alex <b> ", birthday: "1996-11-21", time: "07:15" } }));
    expect(r.status).toBe(200);
    ({ slug, ownerToken: token } = r.data);
    expect(slug).toMatch(/^[a-z0-9]{10}$/);
    expect(r.data.name).toBe("Alex b");
    const [m] = await sql`select owner_token_hash, birth_date::text b, birth_time::text t from maps where slug = ${slug}`;
    expect(m.owner_token_hash).not.toContain(token);
    expect(m.b).toBe("1996-11-21");
    expect(m.t).toBe("07:15:00");
  });

  it("친구: 동의하면 지도에 올라가고, 안 하면 결과만", async () => {
    const yes = await call(addEntry, req(`/api/maps/entries?slug=${slug}`, { body: { nickname: "Jordan", birthday: "1995-04-02", time: "23:40", consent: true } }));
    expect(yes.status).toBe(200);
    expect(yes.data).toMatchObject({ added: true, owner: { name: "Alex b" }, relation: { kind: "mirror" } });
    expect(JSON.stringify(yes.data.owner)).not.toMatch(/sunLongitude|pillars|dayPillar/);
    expect(yes.data.sign.pillars.hour).not.toBeNull();
    const no = await call(addEntry, req(`/api/maps/entries?slug=${slug}`, { body: { nickname: "Sam", birthday: "1990-07-04" }, ip: "198.51.100.2" }));
    expect(no.data.added).toBe(false);
    expect(no.data.sign.name).toBeTruthy();
    expect((await sql`select count(*)::int n from map_entries`)[0].n).toBe(1);
  });

  it("보기: 손님도 별명·타입·관계는 보지만 생일은 누구에게도 안 나감", async () => {
    const guest = await call(getMap, req(`/api/maps?slug=${slug}`));
    expect(guest.data.isOwner).toBe(false);
    expect(guest.data.entries).toHaveLength(1);
    expect(JSON.stringify(guest.data)).not.toContain("1995-04-02");
    expect(JSON.stringify(guest.data)).not.toContain("1996-11-21");
    // 생일을 거꾸로 알아낼 수 있는 값(태양 황경·기둥)도 손님에게는 안 나감
    for (const k of ["sunLongitude", "pillars", "dayPillar", "07:15"]) expect(JSON.stringify(guest.data)).not.toContain(k);
    const owner = await call(getMap, req(`/api/maps?slug=${slug}`, { headers: { "x-owner-token": token } }));
    expect(owner.data.isOwner).toBe(true);
    expect(owner.data.sign.pillars.hour).not.toBeNull();
    expect(JSON.stringify(owner.data)).not.toContain("1995-04-02");
  });

  it("지우기: 주인만", async () => {
    const id = (await call(getMap, req(`/api/maps?slug=${slug}`))).data.entries[0].id;
    expect((await call(delEntry, req(`/api/maps/entries?slug=${slug}&id=${id}`, { method: "DELETE", headers: { "x-owner-token": "wrong" } }))).status).toBe(403);
    expect((await call(delEntry, req(`/api/maps/entries?slug=${slug}&id=${id}`, { method: "DELETE" }))).status).toBe(403);
    expect((await call(delEntry, req(`/api/maps/entries?slug=${slug}&id=${id}`, { method: "DELETE", headers: { "x-owner-token": token } }))).status).toBe(200);
    expect((await call(getMap, req(`/api/maps?slug=${slug}`))).data.entries).toHaveLength(0);
    // 두 번 지우면 없음
    expect((await call(delEntry, req(`/api/maps/entries?slug=${slug}&id=${id}`, { method: "DELETE", headers: { "x-owner-token": token } }))).status).toBe(404);
  });

  it("없는 지도·이상한 주소", async () => {
    expect((await call(getMap, req("/api/maps?slug=zzzzzzzzzz"))).status).toBe(404);
    expect((await call(getMap, req("/api/maps?slug=../../etc"))).status).toBe(404);
    expect((await call(addEntry, req("/api/maps/entries?slug=zzzzzzzzzz", { body: { nickname: "x", birthday: "1990-01-01", consent: true } }))).status).toBe(404);
  });

  it("도배 방지: 같은 IP는 한 지도에 1시간 5명까지", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      codes.push((await call(addEntry, req(`/api/maps/entries?slug=${slug}`, { body: { nickname: `F${i}`, birthday: "1990-01-0" + (i + 1), consent: true }, ip: "192.0.2.9" }))).status);
    }
    expect(codes).toEqual([200, 200, 200, 200, 200, 429, 429]);
  });

  it("빈 별명은 거절", async () => {
    expect((await call(addEntry, req(`/api/maps/entries?slug=${slug}`, { body: { nickname: "   ", birthday: "1990-01-01", consent: true }, ip: "192.0.2.50" }))).status).toBe(400);
  });
});
