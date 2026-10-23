# 백로그

## 오픈 전 (돈 받기 전 꼭)
- [사장님] 도메인 구입 (withsaju.com 등) → Vercel 연결, SITE_URL
- [사장님] Paddle 가입·심사 (사업자 정보, 사이트에 약관·환불·가격 필요) → [Claude] 결제 연결, READINGS_MODE=paid (결제 확인 후 생성, payment_id 한 번만, 결제 이메일을 리포트에 연결)
- [사장님] 약관 검토: 판매자 이름(브랜드 vs 법적 이름), 환불 정책 확정 — 페이지는 완료(/terms /privacy /refund)
- [사장님] 실제 메일 켜기: Resend 무료 가입 → 도메인 인증(DNS) → Vercel에 RESEND_API_KEY, EMAIL_FROM, EMAIL_MODE=live
- [사장님] Vercel 환경 변수: ADMIN_KEY(통계 화면 열쇠), TELEGRAM_BOT_TOKEN·TELEGRAM_CHAT_ID(알림), CONTACT_EMAIL(도메인 후)
- [Claude] 결제 붙으면 판매 텔레그램 알림

## 오픈 후
- 지도에 친구가 올라오면 주인에게 알림 메일
- 지도 도배 방지 강화 (봇 차단), 신고 기능
- 리포트 품질 실험실 (BZR 프롬프트 실험실처럼)
- AI 일러스트 버전 (승인 필요, 약 $10)

## 안 하기로 함
- 구글·애플 로그인 (이메일 열쇠로 대신, D20)
- 출생지 입력 (사주는 출생지 없이 계산, D12)
