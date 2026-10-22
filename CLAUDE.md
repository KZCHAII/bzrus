# WITHSAJU (bzrus) — 미국용 Korean Saju 서비스

이 저장소는 WITHSAJU(미국 전용) 전용이다. BZR(한국판, KZCHAII/BZR)·매일국어 등 다른 프로젝트의 파일·저장소·Supabase·Vercel 프로젝트는 절대 건드리지 않는다. BZR 코드는 읽어서 복사해 오는 것만 허용.

## 역할
- Claude가 코드 작성·테스트·배포를 맡는다. 사장님(강지찬)은 무엇을 만들지 정하고 결과를 확인한다.
- 사장님은 서버·DB 경험이 적다. 요약은 한국어로, 쉬운 말로, 확인할 화면 주소와 순서를 포함해서.
- 취미 프로젝트. 매일국어가 우선. 사장님 시간을 쓰게 하는 질문은 최소로.

## 제품
- 미국 시장 전용 (영어, 달러). 카카오·포트원·카톡 발송 없음.
- 컨셉: "You know your zodiac sign. Meet your Korean one." 사주 일간 × 태어난 계절 = 40가지 Korean sign.
- 퍼지는 구조: 내 Sky map 링크 공유 → 친구가 생일 넣으면 관계 타입(Mirror/Battery/Spark/Co-pilot/Coach)과 함께 지도에 올라감.
- 디자인: BZR 디자인(검정 격자·시안 네온·각진 패널·모노 폰트)을 따른다. WITHSAJU 예전 파일에서는 계산 로직만 가져왔다.

## 구조
- 화면: `public/*.html` + `public/js/withsaju.js` + `public/css/withsaju.css`. Next.js가 정적 파일로 서빙 (`/` → index.html, `/m/<slug>` → map.html).
- 서버: Next.js API (`app/api/**`).
- 사주 계산: `lib/saju.ts` 하나가 기준 (화면은 API로 받아 쓴다). 만세력 라이브러리와 대조 테스트 있음.
- DB: Vercel 연동 Neon Postgres (무료, 미국 동부). 스키마는 `supabase/migrations/*.sql`, 모든 표 RLS(정책 없음 = 서버만 접근). 배포 빌드 때 `scripts/db-migrate.mjs`가 자동 적용.
- 배포: GitHub push → Vercel 자동 배포 (iad1).
- 예정: 로그인(구글·애플), 결제(Paddle, merchant of record), 이메일 발송, AI 리포트(BZR의 생성·재시도·카드 결과지 방식).

## 절대 원칙
- 손님이 보는 디자인·문구·가격은 사장님이 시키지 않으면 바꾸지 않는다.
- 비밀 값은 `.env.local`과 Vercel 환경 변수에만. 커밋·로그·화면 출력 금지. `.env.example`에는 이름만.
- 결제 성공은 서버가 결제사에 직접 확인한 것만 인정. 같은 결제 ID는 한 번만.
- 생일 등 개인정보는 API 응답으로 다른 사람에게 절대 내보내지 않는다 (지도에는 별명·타입·관계만).
- 모든 DB 변경은 migration SQL. 새 표에는 RLS. `npm run test:db` 통과해야 반영.
- 실제 결제·실제 이메일 발송은 테스트 모드로만. 실제 모드 전환은 사장님이 한다.
- 문구에 "For entertainment purposes only" 유지 (미국 일부 주의 점술 규제 대비).

## 작업 방식
- 묻지 말고 가장 추천하는 방법으로 끝까지 진행. 정한 것은 docs/decisions.md에 이유와 함께.
- 끝낼 때마다: `npm run lint && npm run typecheck && npm test && npm run test:db && npm run build` → 커밋 → push.
- docs/progress.md를 작업마다 갱신. "백로그에 추가" = docs/backlog.md에 적기.
- 테스트 데이터는 `is_test = true`로 표시.

## 멈출 조건 (이것만)
- 실제 돈이 오가는 동작(유료 플랜 가입 포함), 실제 손님에게 가는 발송, AI 비용 $5 초과, 기존 실제 데이터 삭제·변경.
