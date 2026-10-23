// 결제: 결제 대기 → 웹훅(서명) → 주문 직접 조회(상태·통화·금액·상품) → 생성. 같은 주문 한 번만, 환불 기록
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { createTestDb } from "./helpers/db";
import { call, req } from "./helpers/req";
import { setServices } from "@/lib/services";
import { setBackground } from "@/lib/background";
import type { LsOrder } from "@/lib/lemon";
import { POST as createRoute, GET as viewRoute } from "@/app/api/readings/route";
import { GET as modeRoute } from "@/app/api/readings/mode/route";
import { POST as webhook } from "@/app/api/pay/webhook/route";
import type { Sql } from "@/lib/db";

let sql: Sql, drop: () => Promise<void>;
beforeAll(async () => { ({ sql, drop } = await createTestDb()); });
afterAll(() => drop());

const SECRET = "whsec_test_123";
const REPORT = "##Strategic Destiny Report\n" + "You decide fast. ".repeat(60) + "\n\n##Final Recommendation\nKeep going.";
let orders: Record<string, LsOrder> = {};
const tasks: Promise<unknown>[] = [];
const flush = async () => { while (tasks.length) await Promise.all(tasks.splice(0)); };

beforeEach(() => {
  Object.assign(process.env, { READINGS_MODE: "paid", LEMONSQUEEZY_API_KEY: "k", LEMONSQUEEZY_STORE_ID: "1", LEMONSQUEEZY_VARIANT_ID: "42", LEMONSQUEEZY_WEBHOOK_SECRET: SECRET });
  orders = {};
  setBackground((fn) => { tasks.push(fn().catch(() => {})); });
  setServices({
    ai: { generate: async (_m, _p, o) => (o?.schema ? JSON.stringify({ core: { headline: "h", body: "b", strength: { title: "t", desc: "d" }, caution: { title: "t", desc: "d" } }, sections: [] }) : REPORT) },
    pay: { createCheckout: async ({ readingId }) => `https://shop.lemonsqueezy.com/checkout/custom/${readingId}`, getOrder: async (id) => orders[id] ?? null },
  });
});
afterEach(() => {
  for (const k of ["READINGS_MODE", "LEMONSQUEEZY_API_KEY", "LEMONSQUEEZY_STORE_ID", "LEMONSQUEEZY_VARIANT_ID", "LEMONSQUEEZY_WEBHOOK_SECRET", "LEMONSQUEEZY_TEST_MODE"]) delete process.env[k];
  setServices(null); setBackground(null);
});

const order = (id: string, o: Partial<LsOrder> = {}): LsOrder => (orders[id] = { id, status: "paid", currency: "USD", subtotal: 999, total: 999, testMode: true, email: "buyer@example.com", variantId: "42", ...o });
function hook(event: string, orderId: string, readingId: string | null, sig?: string) {
  const raw = JSON.stringify({ meta: { event_name: event, custom_data: readingId ? { reading_id: readingId } : undefined }, data: { type: "orders", id: orderId, attributes: { status: "paid", total: 1 } } });
  // 결제사가 보내는 그대로: 본문 문자열 + 그 본문의 HMAC
  return new Request("http://localhost/api/pay/webhook", { method: "POST", headers: { "x-signature": sig ?? createHmac("sha256", SECRET).update(raw).digest("hex") }, body: raw });
}
const input = { name: "Alex", birthday: "1992-03-15", time: "14:30", gender: "woman" };
async function newReading(ip: string) {
  const r = await call(createRoute, req("/api/readings", { body: input, ip }));
  expect(r.status).toBe(200);
  return r.data as { id: string; key: string; checkoutUrl: string };
}
const view = async (id: string, key: string) => (await call(viewRoute, req(`/api/readings?id=${id}&k=${encodeURIComponent(key)}`))).data;

describe("결제", () => {
  it("paid인데 설정이 없으면 예약 모드로 보이고 만들기 막힘", async () => {
    delete process.env.LEMONSQUEEZY_API_KEY;
    expect((await call(modeRoute, req("/api/readings/mode"))).data.mode).toBe("reserve");
    expect((await call(createRoute, req("/api/readings", { body: input, ip: "4.4.4.0" }))).status).toBe(403);
  });

  it("결제 대기 → 웹훅 → 주문 확인 → 생성 → 판매 기록", async () => {
    expect((await call(modeRoute, req("/api/readings/mode"))).data).toEqual({ mode: "paid", testPayments: true });
    const r = await newReading("4.4.4.1");
    expect(r.checkoutUrl).toContain(r.id);
    expect(await view(r.id, r.key)).toMatchObject({ status: "awaiting_payment", checkoutUrl: r.checkoutUrl });
    await flush();
    expect((await sql`select status from readings where id = ${r.id}`)[0].status).toBe("awaiting_payment"); // 결제 전엔 AI 안 돈다
    order("1001");
    const w = await call(webhook, hook("order_created", "1001", r.id));
    expect(w.data).toEqual({ ok: true, result: "paid" });
    await flush();
    const [row] = await sql`select status, payment_id, amount_cents, currency, email, is_test, paid_at from readings where id = ${r.id}`;
    expect(row).toMatchObject({ status: "done", payment_id: "ls_1001", amount_cents: 999, currency: "USD", email: "buyer@example.com", is_test: true });
    expect(row.paid_at).not.toBeNull();
    // 같은 주문 다시 와도 한 번만
    expect((await call(webhook, hook("order_created", "1001", r.id))).data.result).toBe("duplicate");
    expect((await sql`select count(*)::int n from events where name = 'reading_paid'`)[0].n).toBe(1);
  });

  it("서명이 틀리면 401, 아무것도 안 바뀜", async () => {
    const r = await newReading("4.4.4.2");
    order("1002");
    expect((await call(webhook, hook("order_created", "1002", r.id, "deadbeef"))).status).toBe(401);
    expect((await sql`select status from readings where id = ${r.id}`)[0].status).toBe("awaiting_payment");
  });

  it("주문 조회 결과가 안 맞으면 거절 (상태·금액·통화·상품·테스트 여부)", async () => {
    const cases: [Partial<LsOrder>, string][] = [
      [{ status: "pending" }, "rejected_status_pending"], [{ subtotal: 100 }, "rejected_amount_100"], [{ currency: "EUR" }, "rejected_currency_EUR"],
      [{ variantId: "7" }, "rejected_variant_7"], [{ testMode: false }, "rejected_test_mode_mismatch"],
    ];
    for (const [i, [o, want]] of cases.entries()) {
      const r = await newReading(`4.4.5.${i}`);
      order(`20${i}`, o);
      expect((await call(webhook, hook("order_created", `20${i}`, r.id))).data.result).toBe(want);
      expect((await sql`select status from readings where id = ${r.id}`)[0].status).toBe("awaiting_payment");
    }
    // 결제사에 그런 주문이 없으면
    const r = await newReading("4.4.6.1");
    expect((await call(webhook, hook("order_created", "9999", r.id))).data.result).toBe("order_lookup_failed");
  });

  it("환불: 결제사 확인 후 기록", async () => {
    const r = await newReading("4.4.7.1");
    order("3001");
    await call(webhook, hook("order_created", "3001", r.id)); await flush();
    order("3001", { status: "refunded" });
    expect((await call(webhook, hook("order_refunded", "3001", r.id))).data.result).toBe("refunded");
    expect((await sql`select refunded_at from readings where id = ${r.id}`)[0].refunded_at).not.toBeNull();
    expect((await sql`select count(*)::int n from payment_events where order_id = '3001'`)[0].n).toBe(2);
  });

  it("결제 대기 리포트는 IP당 하루 10개까지", async () => {
    const codes = [];
    for (let i = 0; i < 11; i++) codes.push((await call(createRoute, req("/api/readings", { body: input, ip: "4.4.8.8" }))).status);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes[10]).toBe(429);
  });
});

describe("결제 설정 값의 앞뒤 공백", () => {
  it("비밀 값에 줄바꿈이 붙어 있어도 서명 확인은 된다", async () => {
    const { verifyLsSignature, lsConfig } = await import("@/lib/lemon");
    Object.assign(process.env, { LEMONSQUEEZY_API_KEY: "k", LEMONSQUEEZY_STORE_ID: " 1 ", LEMONSQUEEZY_VARIANT_ID: "42\n", LEMONSQUEEZY_WEBHOOK_SECRET: "whsec_x \n" });
    const c = lsConfig()!;
    expect(c).toMatchObject({ storeId: "1", variantId: "42", webhookSecret: "whsec_x" });
    const raw = '{"a":1}';
    expect(verifyLsSignature(raw, createHmac("sha256", "whsec_x").update(raw).digest("hex"), c.webhookSecret)).toBe(true);
  });
});
