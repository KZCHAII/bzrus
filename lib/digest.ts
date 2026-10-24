// 매일 요약 (텔레그램): 어제 하루 + 최근 7일
import { stats } from "./events";
import { notify } from "./notify";
import { getSql } from "./db";

export async function dailyDigest() {
  // 하루(한국 날짜) 한 번만. 이미 보냈으면 그냥 끝
  const [first] = await getSql()<{ job: string }[]>`
    insert into cron_runs (job, day) values ('daily_digest', (now() at time zone 'Asia/Seoul')::date)
    on conflict do nothing returning job`;
  if (!first) return { sent: false, reason: "already_sent_today" };
  const s = await stats(8);
  const y = s.days[1]; // [0] = 오늘(한국 시간), [1] = 어제
  const week = s.days.slice(1).reduce((a, d) => ({ visitors: a.visitors + d.visitors, maps: a.maps + d.maps, entries: a.entries + d.entries, readings: a.readings + d.readings, paid: a.paid + d.paid, rev: a.rev + d.revenueCents }), { visitors: 0, maps: 0, entries: 0, readings: 0, paid: 0, rev: 0 });
  const lines = [
    `<b>📊 어제 (${y.day})</b>`,
    `방문 ${y.visitors}명 · 사인 ${y.signs} · 페이지 생성 ${y.maps}`,
    `친구 입력 ${y.entries} · 공유 ${y.shares} · 친구→내 페이지 ${y.ownFromGuest}`,
    `💰 판매 ${y.paid}건 $${(y.revenueCents / 100).toFixed(2)}${y.paidTest ? ` (테스트 ${y.paidTest})` : ""} · 결제창 ${y.checkouts}`,
    `리포트 ${y.readings}${y.readingsFailed ? ` (실패 ${y.readingsFailed})` : ""} · 유료 안내 클릭 ${y.upsell} · 이메일 저장 ${y.emails}`,
    ``,
    `<b>최근 7일</b> 방문 ${week.visitors} · 페이지 ${week.maps} · 친구 ${week.entries} · 리포트 ${week.readings} · 판매 ${week.paid}건 $${(week.rev / 100).toFixed(2)}`,
    `페이지당 친구 평균 ${s.totals.entriesPerMap}명`,
    s.sources.length ? `유입: ${s.sources.slice(0, 4).map((x) => `${x.src} ${x.visitors}`).join(", ")}` : "",
  ].filter((l, i, a) => l || a[i - 1]);
  await notify(lines.join("\n"));
  return { sent: true, day: y.day };
}
