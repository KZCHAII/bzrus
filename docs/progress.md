# 진행 상황

## 2026-10-22 — 뼈대
- 저장소·설정: BZR 설정을 복사해 Next.js 16 + Postgres + vitest + 로컬 테스트 DB 구성.
- 사주 엔진 `lib/saju.ts`: 네 기둥(절입 시각 반영), Korean sign 40가지, 별자리, 관계 5종. 만세력 라이브러리와 대조 테스트.
- DB: `maps`, `map_entries` (RLS, 서버만 접근).
- API: `POST /api/sign`, `POST/GET /api/maps`, `POST/DELETE /api/maps/entries`.
- 화면: `/` 랜딩(BZR 디자인), `/m/<slug>` 지도(주인 화면 / 친구 화면).
- 아직 없음: 실제 DB(Supabase), 로그인, 결제, 이메일, AI 리포트 → backlog.md
