// 환경 변수 이름 목록. 값은 .env.local / Vercel 환경 변수에만 둔다.
export const ENV_NAMES = [
  "DATABASE_URL",   // Supabase Postgres 연결 문자열 (서버 전용)
  "IP_SALT",        // IP를 해시로만 저장할 때 섞는 값 (도배 방지용)
  "SITE_URL",       // 공유 링크에 쓰는 주소 (예: https://withsaju.com)
  "GEMINI_API_KEY", // 상세 리포트 생성 (BZR과 같은 키를 써도 됨)
  "READINGS_MODE",  // 'reserve'(기본: 예약만) | 'test'(무료 시험 생성, 하루 상한) | 'paid'(결제 후 생성 — 결제 연결 뒤)
  "TEST_DAILY_CAP", // test 모드 하루 전체 생성 상한 (기본 10)
  "EMAIL_MODE",     // 'test'(기본: 보내지 않고 email_outbox에만 기록) | 'live'(Resend로 실제 발송 — 사장님이 켬)
  "RESEND_API_KEY", // 메일 발송 (Resend)
  "EMAIL_FROM",     // 보내는 주소 (예: WITHSAJU <hello@withsaju.com>) — 도메인 인증 필요
] as const;

export type EnvName = (typeof ENV_NAMES)[number];

export function envOptional(name: EnvName): string | undefined {
  const v = process.env[name];
  return v === "" ? undefined : v;
}
