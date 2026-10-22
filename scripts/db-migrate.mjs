// 배포(빌드) 때 DB 스키마를 자동으로 맞춘다. supabase/migrations/*.sql 중 아직 안 넣은 것만 순서대로.
// DB 주소가 없으면(로컬 빌드·DB 없는 미리보기) 건너뛴다. 비밀 값은 출력하지 않는다.
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!raw) {
  console.log("[db-migrate] DB 주소 없음 → 건너뜀");
  process.exit(0);
}
const url = raw.split("?")[0];
const local = url.includes("127.0.0.1") || url.includes("localhost");
const sql = postgres(url, { max: 1, ssl: local ? false : "require", onnotice: () => {}, prepare: false });
try {
  await sql`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  await sql`alter table public.schema_migrations enable row level security`;
  const dir = join(root, "supabase/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  await sql.begin(async (tx) => {
    // 동시에 두 배포가 돌아도 한 번만 적용
    await tx`select pg_advisory_xact_lock(724001)`;
    const done = new Set((await tx`select name from public.schema_migrations`).map((r) => r.name));
    for (const f of files) {
      if (done.has(f)) continue;
      await tx.unsafe(readFileSync(join(dir, f), "utf8"));
      await tx`insert into public.schema_migrations (name) values (${f})`;
      console.log(`[db-migrate] 적용: ${f}`);
    }
  });
  console.log(`[db-migrate] 완료 (${files.length}개 확인)`);
} finally {
  await sql.end();
}
