// 환경 변수 이름 목록. 값은 .env.local / Vercel 환경 변수에만 둔다.
export const ENV_NAMES = [
  "DATABASE_URL",   // Supabase Postgres 연결 문자열 (서버 전용)
  "IP_SALT",        // IP를 해시로만 저장할 때 섞는 값 (도배 방지용)
  "SITE_URL",       // 공유 링크에 쓰는 주소 (예: https://withsaju.com)
] as const;

export type EnvName = (typeof ENV_NAMES)[number];

export function envOptional(name: EnvName): string | undefined {
  const v = process.env[name];
  return v === "" ? undefined : v;
}
