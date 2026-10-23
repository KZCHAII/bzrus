// 이메일 = 열쇠. 비밀번호도 구글 로그인도 없이:
// 1) 내 페이지에 이메일 저장 / 리포트는 만들 때 이메일 받음
// 2) 다른 기기에서 "Find my page" → 이메일 입력 → 메일 속 링크(30분, 한 번) → 그 기기에 페이지 열쇠 + 리포트 링크
import { randomBytes } from "node:crypto";
import { getSql } from "./db";
import { HttpError, str } from "./http";
import { envOptional } from "./env";
import { hashIp, isOwner, loadMap, maskEmail, sha } from "./maps";
import { cleanEmail } from "./reading";
import { mailHtml, sendEmail } from "./email";
import { track } from "./events";

const LINK_MIN = 30;
const PER_EMAIL_PER_HOUR = 4;
const PER_IP_PER_HOUR = 10;

/** 메일 속 링크의 주소: SITE_URL(도메인 정해지면) → 없으면 요청이 들어온 주소 */
export function siteBase(req?: Request): string {
  const s = envOptional("SITE_URL");
  if (s) return s.replace(/\/+$/, "");
  if (req) { const u = new URL(req.url); return `${u.protocol}//${u.host}`; }
  return "https://bzrus.vercel.app";
}

/** 내 페이지에 이메일 저장 (주인만). 확인 메일에 페이지 링크와 찾는 법을 적어 보낸다 */
export async function saveMapEmail(slug: string, ownerToken: string, emailIn: unknown, base: string, isTest = false) {
  const m = await loadMap(slug);
  if (!(await isOwner(m, ownerToken))) throw new HttpError(403, "NOT_OWNER");
  const email = cleanEmail(emailIn);
  await getSql()`update maps set owner_email = ${email} where id = ${m.id}`;
  const page = `${base}/m/${m.slug}`, find = `${base}/find`;
  await sendEmail({
    to: email, kind: "page_saved",
    subject: `${m.name}, your WITHSAJU page is saved`,
    text: `Your page is saved to this email.\n\nShare this link with friends: ${page}\n\nOn a new phone or browser, go to ${find}, enter this email, and tap the link we send. Your page and your readings come back.`,
    html: mailHtml("Your page is saved", ["Share this link with friends. Every birthday they add lands on your map.", `On a new phone or browser, go to ${find} and enter this email. We'll send you a link that opens your page and your readings.`], { label: "Open my page", url: page }, "You got this because someone saved a WITHSAJU page with this email. If it wasn't you, ignore it."),
  }, isTest);
  await track("page_email_saved", { isTest });
  return { saved: true, email: maskEmail(email) };
}

/** 로그인 링크 요청. 그 이메일에 연결된 것이 있을 때만 실제로 보낸다. 응답은 항상 같다 (있는지 없는지 알려 주지 않음) */
export async function requestLogin(emailIn: unknown, ip: string, base: string, isTest = false) {
  const email = cleanEmail(emailIn);
  const sql = getSql();
  const ipHash = hashIp(ip);
  const [{ e }] = await sql<{ e: number }[]>`select count(*)::int e from login_links where email = ${email} and created_at > now() - interval '1 hour'`;
  if (e >= PER_EMAIL_PER_HOUR) throw new HttpError(429, "TOO_MANY", { error: "TOO_MANY", message: "We already sent a few links. Check your inbox and spam, or try again in an hour." });
  if (ipHash) {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from login_links where ip_hash = ${ipHash} and created_at > now() - interval '1 hour'`;
    if (n >= PER_IP_PER_HOUR) throw new HttpError(429, "TOO_MANY", { error: "TOO_MANY", message: "Too many tries. Try again in an hour." });
  }
  const [{ has }] = await sql<{ has: boolean }[]>`select exists(select 1 from maps where owner_email = ${email}) or exists(select 1 from readings where email = ${email}) has`;
  const token = randomBytes(32).toString("base64url");
  await sql`insert into login_links (email, token_hash, ip_hash, expires_at, is_test)
            values (${email}, ${sha(token)}, ${ipHash}, now() + make_interval(mins => ${LINK_MIN}), ${isTest})`;
  if (has) {
    // #뒤는 서버·메일 링크 검사기에 안 넘어간다 → 미리 열어 보는 검사기가 링크를 써 버리지 못함
    const url = `${base}/find#t=${token}`;
    await sendEmail({
      to: email, kind: "login",
      subject: "Your WITHSAJU link",
      text: `Tap to open your page and readings on this device:\n${url}\n\nThe link works once, for ${LINK_MIN} minutes. If you didn't ask for it, ignore this email.`,
      html: mailHtml("Open your page and readings", ["Tap the button on the phone or computer where you want to open them."], { label: "Open on this device", url }, `The link works once, for ${LINK_MIN} minutes. If you didn't ask for it, ignore this email.`),
    }, isTest);
  }
  await track("login_requested", { ref: has ? "known" : "unknown", isTest });
  return { sent: true };
}

/** 링크 사용: 한 번만. 이 기기용 페이지 열쇠를 새로 만들어 주고, 리포트 링크를 돌려준다 */
export async function redeemLogin(tokenIn: unknown) {
  const token = str(tokenIn, 100);
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new HttpError(400, "BAD_LINK", { error: "BAD_LINK", message: "This link isn't valid. Ask for a new one." });
  const sql = getSql();
  const [l] = await sql<{ email: string }[]>`update login_links set used_at = now()
    where token_hash = ${sha(token)} and used_at is null and expires_at > now() returning email`;
  if (!l) throw new HttpError(410, "LINK_EXPIRED", { error: "LINK_EXPIRED", message: "This link has expired or was already used. Ask for a new one." });
  const maps = await sql<{ id: string; slug: string; name: string }[]>`select id, slug, name from maps where owner_email = ${l.email} order by created_at desc limit 20`;
  const outMaps = [];
  for (const m of maps) {
    const key = randomBytes(24).toString("base64url");
    await sql`insert into map_keys (map_id, token_hash) values (${m.id}, ${sha(key)})`;
    outMaps.push({ slug: m.slug, name: m.name, ownerToken: key });
  }
  const readings = await sql<{ id: string; view_key: string; name: string; status: string; created_at: Date }[]>`
    select id, view_key, name, status, created_at from readings where email = ${l.email} order by created_at desc limit 20`;
  await track("login_used");
  return {
    email: maskEmail(l.email),
    maps: outMaps,
    readings: readings.map((r) => ({ id: r.id, key: r.view_key, name: r.name, status: r.status, createdAt: r.created_at })),
  };
}

/** 리포트가 다 써지면: "Your reading is ready" (이메일이 있을 때) */
export async function mailReadingReady(r: { id: string; view_key: string; name: string; email: string | null; is_test: boolean }) {
  if (!r.email) return;
  const url = `${siteBase()}/r/${r.id}?k=${encodeURIComponent(r.view_key)}`;
  await sendEmail({
    to: r.email, kind: "reading_ready",
    subject: `${r.name}, your Korean Saju reading is ready`,
    text: `Your full reading is ready:\n${url}\n\nKeep this email. The link opens your reading on any device. Lost it? Go to ${siteBase()}/find and enter this email.`,
    html: mailHtml("Your reading is ready", ["Your four pillars, your current 10-year cycle, the next five years, who fits you and how to boost your luck.", "Keep this email. The link opens your reading on any phone or computer."], { label: "Open my reading", url }, `Lost it later? Go to ${siteBase()}/find and enter this email.`),
  }, r.is_test);
}
