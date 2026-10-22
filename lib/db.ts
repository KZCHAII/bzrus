import postgres from "postgres";

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

let _sql: Sql | null = null;

/** 서버 전용 DB 연결 (Supabase 연결 문자열, service 권한). 테스트는 setSql로 바꿔 끼운다. */
export function getSql(): Sql {
  if (_sql) return _sql;
  // DATABASE_URL 직접 지정, 없으면 Supabase–Vercel 연동이 자동으로 넣어 주는 POSTGRES_URL(트랜잭션 풀러) 사용
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) throw new Error("DATABASE_URL(또는 POSTGRES_URL)이 없습니다");
  // 연동이 붙이는 ?sslmode=…&supa=… 같은 꼬리는 Postgres 설정으로 오해되므로 떼어 낸다 (SSL은 아래에서 켬)
  const url = raw.split("?")[0];
  _sql = postgres(url, {
    max: 5,
    idle_timeout: 20,
    prepare: false, // Supabase 트랜잭션 풀러(6543) 호환
    ssl: url.includes("127.0.0.1") || url.includes("localhost") ? false : "require",
  });
  return _sql;
}

export function setSql(sql: Sql | null) {
  _sql = sql;
}
