import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { setSql, type Sql } from "@/lib/db";

const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/postgres";
const root = join(__dirname, "..", "..");

/** 테스트마다 새 DB를 만들고 마이그레이션을 적용한다. */
export async function createTestDb(): Promise<{ sql: Sql; url: string; drop: () => Promise<void> }> {
  const name = `bzrus_t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  await admin.end();
  const url = ADMIN_URL.replace(/\/[^/]+$/, `/${name}`);
  const sql = postgres(url, { max: 4, onnotice: () => {} });
  await sql.unsafe(readFileSync(join(root, "supabase/test/shim.sql"), "utf8"));
  const dir = join(root, "supabase/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await sql.unsafe(readFileSync(join(dir, f), "utf8"));
  }
  setSql(sql);
  return {
    sql,
    url,
    drop: async () => {
      setSql(null);
      await sql.end();
      const a = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
      await a.unsafe(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

/** 로그인한 화면(authenticated 역할)로서 쿼리를 실행한다. */
export async function asUser<T>(sql: Sql, userId: string | null, fn: (tx: postgres.TransactionSql) => Promise<T>) {
  return sql.begin(async (tx) => {
    await tx.unsafe(`set local role ${userId ? "authenticated" : "anon"}`);
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(userId ? { sub: userId } : {})}, true)`;
    return fn(tx);
  }) as Promise<T>;
}
