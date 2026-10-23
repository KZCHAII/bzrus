// 결제 확인 (Lemon Squeezy 웹훅). 원칙:
// 1) 서명이 맞아야 하고 2) 서버가 결제사에 주문을 직접 조회해 상태·통화·금액·상품이 맞을 때만 인정
// 3) 같은 주문(payment_id)은 한 번만 4) 실패해도 결제사에 200을 돌려 무한 재전송을 막되, 기록·알림은 남긴다
import { getSql } from "./db";
import { HttpError } from "./http";
import { services } from "./services";
import { lsConfig, verifyLsSignature } from "./lemon";
import { READING_PRICE } from "./catalog";
import { track } from "./events";
import { escHtml, notify } from "./notify";
import { generateReading } from "./readings";

type Start = (fn: () => Promise<unknown>) => void;

async function logEvent(event: string, orderId: string | null, readingId: string | null, result: string, testMode: boolean) {
  await getSql()`insert into payment_events (provider, event_name, order_id, reading_id, result, test_mode)
    values ('lemonsqueezy', ${event}, ${orderId}, ${readingId}, ${result}, ${testMode})`.catch((e) => console.error("[pay log]", e instanceof Error ? e.message : e));
}

export async function handleLsWebhook(raw: string, signature: string, start: Start): Promise<{ ok: true; result: string }> {
  const c = lsConfig();
  if (!c) throw new HttpError(503, "PAY_OFF");
  if (!verifyLsSignature(raw, signature, c.webhookSecret)) throw new HttpError(401, "BAD_SIGNATURE");
  let body: { meta?: { event_name?: string; custom_data?: { reading_id?: string } }; data?: { type?: string; id?: string } };
  try { body = JSON.parse(raw); } catch { throw new HttpError(400, "BAD_JSON"); }
  const event = String(body.meta?.event_name ?? "");
  const orderId = body.data?.type === "orders" && body.data.id ? String(body.data.id) : null;
  const readingId = typeof body.meta?.custom_data?.reading_id === "string" && /^[0-9a-f-]{36}$/i.test(body.meta.custom_data.reading_id) ? body.meta.custom_data.reading_id : null;
  const done = async (result: string, testMode = c.testMode) => { await logEvent(event, orderId, readingId, result, testMode); return { ok: true as const, result }; };

  if (!orderId) return done("ignored_not_order");
  if (event === "order_created") return confirmPayment(orderId, readingId, start, done);
  if (event === "order_refunded") {
    const order = await services().pay.getOrder(orderId);
    if (!order || !(order.status === "refunded" || order.status === "partial_refund")) return done("refund_not_confirmed");
    const r = await getSql()<{ id: string; name: string }[]>`update readings set refunded_at = coalesce(refunded_at, now())
      where payment_id = ${"ls_" + orderId} returning id, name`;
    if (r.length) { await track("reading_refunded", { isTest: order.testMode }); await notify(`↩️ 환불: <b>${escHtml(r[0].name)}</b> (주문 ${orderId}${order.testMode ? ", 테스트" : ""})`); }
    return done(r.length ? "refunded" : "refund_unknown_order", order.testMode);
  }
  return done("ignored_event");
}

async function confirmPayment(orderId: string, readingId: string | null, start: Start, done: (r: string, t?: boolean) => Promise<{ ok: true; result: string }>) {
  const c = lsConfig()!;
  const sql = getSql();
  const paymentId = "ls_" + orderId;
  const [dup] = await sql`select id from readings where payment_id = ${paymentId}`;
  if (dup) return done("duplicate");
  // 웹훅 내용은 믿지 않고, 결제사에 직접 물어본다
  const order = await services().pay.getOrder(orderId);
  if (!order) { await notify(`⚠️ 결제 알림 받았는데 주문 조회 실패: ${orderId}`); return done("order_lookup_failed"); }
  const bad = order.status !== "paid" ? "status_" + order.status
    : order.currency !== READING_PRICE.currency ? "currency_" + order.currency
    : order.subtotal !== READING_PRICE.cents ? "amount_" + order.subtotal
    : order.variantId !== c.variantId ? "variant_" + order.variantId
    : order.testMode !== c.testMode ? "test_mode_mismatch" : "";
  if (bad) { await notify(`⚠️ 결제 확인 불일치 (${escHtml(bad)}), 주문 ${orderId}`); return done("rejected_" + bad, order.testMode); }
  if (!readingId) { await notify(`⚠️ 결제는 됐는데 리포트 번호가 없음, 주문 ${orderId} — 손님 확인 필요`); return done("no_reading_id", order.testMode); }
  try {
    const [r] = await sql<{ id: string; name: string }[]>`
      update readings set status = 'generating', payment_id = ${paymentId}, paid_at = now(), amount_cents = ${order.total}, currency = ${order.currency},
             is_test = ${order.testMode}, email = coalesce(email, ${order.email})
       where id = ${readingId} and status = 'awaiting_payment' returning id, name`;
    if (!r) { await notify(`⚠️ 결제 확인됐지만 리포트가 결제 대기 상태가 아님: ${readingId}, 주문 ${orderId}`); return done("reading_not_waiting", order.testMode); }
    await track("reading_paid", { isTest: order.testMode });
    start(() => notify(`💰 판매 ${READING_PRICE.label}${order.testMode ? " (테스트)" : ""}: <b>${escHtml(r.name)}</b> · 주문 ${orderId}`));
    start(() => generateReading(r.id));
    return done("paid", order.testMode);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return done("duplicate");
    throw e;
  }
}
