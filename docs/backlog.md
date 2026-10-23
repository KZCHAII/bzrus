# 백로그

## 오픈 전 (돈 받기 전 꼭)
- [사장님] 도메인 구입 (withsaju.com 등) → Vercel 연결, SITE_URL
- [사장님] Lemon Squeezy 가입·상점 심사 → 상품($9.99)·API 키·웹훅 만들고 Vercel에 LEMONSQUEEZY_* 4개 + READINGS_MODE=paid → [Claude] 테스트 결제로 끝까지 확인 (결제 코드는 완료)
- [사장님] 실제 결제 전환: LEMONSQUEEZY_TEST_MODE=0 + 실제(live) API 키·웹훅
- [사장님] 약관 검토: 판매자 이름(브랜드 vs 법적 이름), 환불 정책 확정 — 페이지는 완료(/terms /privacy /refund)
- [사장님] 실제 메일 켜기: Resend 무료 가입 → 도메인 인증(DNS) → Vercel에 RESEND_API_KEY, EMAIL_FROM, EMAIL_MODE=live
- [사장님] Vercel 환경 변수: ADMIN_KEY(통계 화면 열쇠), TELEGRAM_BOT_TOKEN·TELEGRAM_CHAT_ID(알림), CONTACT_EMAIL(도메인 후)

## 오픈 후
- 지도에 친구가 올라오면 주인에게 알림 메일
- 지도 도배 방지 강화 (봇 차단), 신고 기능
- 리포트 품질 실험실 (BZR 프롬프트 실험실처럼)
- AI 일러스트 버전 (승인 필요, 약 $10)

## 안 하기로 함
- 구글·애플 로그인 (이메일 열쇠로 대신, D20)
- Paddle (사주·운세 판매 금지 목록), Stripe 직접 (한국 사업자 불가) — D23
- 출생지 입력 (사주는 출생지 없이 계산, D12)
