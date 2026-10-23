// Lemon Squeezy: 결제창 만들기 · 주문 직접 조회 · 웹훅 서명 확인.
// 키는 Vercel 환경 변수에만. LEMONSQUEEZY_TEST_MODE 가 '0'이 아니면 테스트 결제(실제 돈 안 나감) — 실제 전환은 사장님이.
import { createHmac, timingSafeEqual } from "node:crypto";
import { envOptional } from "./env";

const API = "https://api.lemonsqueezy.com/v1";

export interface LsConfig { apiKey: string; storeId: string; variantId: string; webhookSecret: string; testMode: boolean }
export function lsConfig(): LsConfig | null {
  // 붙여넣을 때 끼어든 앞뒤 공백·줄바꿈은 무시 (서명 불일치의 흔한 원인)
  const t = (v: string | undefined) => v?.trim() || undefined;
  const apiKey = t(envOptional("LEMONSQUEEZY_API_KEY")), storeId = t(envOptional("LEMONSQUEEZY_STORE_ID")), variantId = t(envOptional("LEMONSQUEEZY_VARIANT_ID")), webhookSecret = t(envOptional("LEMONSQUEEZY_WEBHOOK_SECRET"));
  if (!apiKey || !storeId || !variantId || !webhookSecret) return null;
  return { apiKey, storeId, variantId, webhookSecret, testMode: envOptional("LEMONSQUEEZY_TEST_MODE") !== "0" };
}

/** 웹훅 서명: 받은 그대로의 본문을 비밀 값으로 HMAC-SHA256(hex) 한 것이 X-Signature 와 같아야 한다 */
export function verifyLsSignature(raw: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"), "utf8");
  const got = Buffer.from(signature.trim(), "utf8");
  return want.length === got.length && timingSafeEqual(want, got);
}

export interface LsOrder {
  id: string; status: string; currency: string; subtotal: number; total: number; testMode: boolean;
  email: string | null; variantId: string | null;
}

export interface Pay {
  createCheckout(o: { readingId: string; email?: string | null; name: string; redirectUrl: string }): Promise<string>;
  getOrder(id: string): Promise<LsOrder | null>;
}

async function ls(path: string, init: RequestInit = {}) {
  const c = lsConfig();
  if (!c) throw new Error("LEMONSQUEEZY_NOT_CONFIGURED");
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json", Authorization: `Bearer ${c.apiKey}`, ...(init.headers ?? {}) },
  });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, status: r.status, data };
}

export const realPay: Pay = {
  async createCheckout({ readingId, email, name, redirectUrl }) {
    const c = lsConfig()!;
    const r = await ls("/checkouts", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            product_options: { redirect_url: redirectUrl, receipt_button_text: "Open my reading", receipt_link_url: redirectUrl },
            checkout_options: { embed: false, media: true, logo: true },
            checkout_data: { ...(email ? { email } : {}), name, custom: { reading_id: readingId } },
            test_mode: c.testMode,
            expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
          },
          relationships: {
            store: { data: { type: "stores", id: c.storeId } },
            variant: { data: { type: "variants", id: c.variantId } },
          },
        },
      }),
    });
    const url = (r.data as { data?: { attributes?: { url?: string } } }).data?.attributes?.url;
    if (!r.ok || !url) throw new Error(`LS_CHECKOUT_${r.status}`);
    return url;
  },
  async getOrder(id) {
    if (!/^\d{1,20}$/.test(id)) return null;
    const r = await ls(`/orders/${id}`);
    if (!r.ok) return null;
    const a = ((r.data as { data?: { attributes?: Record<string, unknown> } }).data?.attributes ?? {}) as Record<string, unknown>;
    const item = (a.first_order_item ?? {}) as { variant_id?: number | string };
    return {
      id, status: String(a.status ?? ""), currency: String(a.currency ?? ""), subtotal: Number(a.subtotal ?? 0), total: Number(a.total ?? 0),
      testMode: a.test_mode === true, email: typeof a.user_email === "string" ? a.user_email : null,
      variantId: item.variant_id != null ? String(item.variant_id) : null,
    };
  },
};
