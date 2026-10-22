// 화면 쪽 역할(anon·authenticated)은 지도 표를 직접 읽거나 쓰지 못한다
import { afterAll, beforeAll, expect, it } from "vitest";
import { asUser, createTestDb } from "../helpers/db";
import type { Sql } from "@/lib/db";

let sql: Sql, drop: () => Promise<void>;
beforeAll(async () => { ({ sql, drop } = await createTestDb()); });
afterAll(() => drop());

it("모든 표에 RLS가 켜져 있다", async () => {
  const rows = await sql`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
  expect(rows.map((r) => r.relname)).toEqual([]);
});

it("anon·authenticated는 읽기·쓰기 불가", async () => {
  await sql`insert into maps (slug, owner_token_hash, name, birth_date, sign_key) values ('abcdefghij', 'h', 'A', '1990-01-01', 'k')`;
  for (const uid of [null, "user-1"]) {
    await expect(asUser(sql, uid, (tx) => tx`select * from maps`)).rejects.toThrow(/permission denied/);
    await expect(asUser(sql, uid, (tx) => tx`select * from map_entries`)).rejects.toThrow(/permission denied/);
    await expect(asUser(sql, uid, (tx) => tx`insert into maps (slug, owner_token_hash, name, birth_date, sign_key) values ('zzzzzzzzzz', 'h', 'B', '1990-01-01', 'k')`)).rejects.toThrow(/permission denied/);
  }
});
