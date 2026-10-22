# 진행 상황

## 2026-10-22 — 뼈대
- 저장소·설정: BZR 설정을 복사해 Next.js 16 + Postgres + vitest + 로컬 테스트 DB 구성.
- 사주 엔진 `lib/saju.ts`: 네 기둥(절입 시각 반영), Korean sign 40가지, 별자리, 관계 5종. 만세력 라이브러리와 대조 테스트.
- DB: `maps`, `map_entries` (RLS, 서버만 접근).
- API: `POST /api/sign`, `POST/GET /api/maps`, `POST/DELETE /api/maps/entries`.
- 화면: `/` 랜딩(BZR 디자인), `/m/<slug>` 지도(주인 화면 / 친구 화면).
- 아직 없음: 실제 DB(Supabase), 로그인, 결제, 이메일, AI 리포트 → backlog.md

## 2026-10-22 — DB 연결 준비
- Vercel 프로젝트 생성 + Neon(무료) 연결 (사장님).
- 배포 때 migration 자동 적용 스크립트 추가, Neon(일반 Postgres)에서도 돌도록 migration 수정.

## 2026-10-22 — 출생 시각
- 입력에 출생 시각(선택) 추가: 랜딩·지도 만들기·친구 입력. DB에 birth_time 저장 (상세 리포트용).
- 시간을 넣으면 카드에 네 기둥(年·月·日·時) 표, 모르면 시주는 "??".
- 계절 경계도 시간까지 반영.
- 개인정보 보강: 다른 사람에게 보이는 사인에서 태양 황경·기둥 값 제거 (생일을 거꾸로 알아낼 수 있어서).
