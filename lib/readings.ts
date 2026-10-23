// 상세 리포트: 만들기(모드 확인·상한) → 백그라운드 생성(AI 글 → 카드) → 보기(비밀 키). 멈춘 생성은 보기 요청 때 다시 시작.
import { createHash, randomBytes } from "node:crypto";
import { getSql } from "./db";
import { HttpError, str } from "./http";
import { envOptional } from "./env";
import { cleanName, hashIp, maskEmail, parseBirthday, type Birth } from "./maps";
import { cleanEmail } from "./reading";
import { chartText, fullChart, type FullChart, type Gender } from "./saju-chart";
import { signOf } from "./saju";
import { services } from "./services";
import { extractCards, MODEL, type Cards } from "./cards";
import { PROMPTS } from "./prompts.generated";
import { mailReadingReady } from "./account";
import { track } from "./events";
import { escHtml, notify } from "./notify";

export const MAX_ATTEMPTS = 3;
const STALE_MIN = 6;              // 이 시간 넘게 '만드는 중'이면 끊긴 것으로 보고 다시
const PER_IP_PER_DAY = 3;
const PROMPT_VERSION = createHash("sha256").update(PROMPTS.reading ?? "").digest("hex").slice(0, 10);

export type Mode = "reserve" | "test" | "paid";
export const readingsMode = (): Mode => {
  const m = envOptional("READINGS_MODE");
  return m === "test" || m === "paid" ? m : "reserve";
};

export function parseGender(v: unknown): Gender {
  const g = str(v, 10).toLowerCase();
  if (g !== "woman" && g !== "man") throw new HttpError(400, "NEED_GENDER", { error: "NEED_GENDER", message: "Choose woman or man. Saju uses it to set the direction of your 10-year luck cycles." });
  return g;
}

interface Row {
  id: string; view_key: string; name: string; birth_date: string; birth_time: string | null; time_unknown: boolean; gender: Gender;
  status: "generating" | "done" | "failed"; attempts: number; started_at: Date | null; completed_at: Date | null;
  content: string | null; error: string | null; cards: Cards | null; cards_status: string | null; created_at: Date; is_test: boolean; email: string | null;
}
const COLS = `id, view_key, name, to_char(birth_date, 'YYYY-MM-DD') birth_date, to_char(birth_time, 'HH24:MI') birth_time, time_unknown, gender,
  status, attempts, started_at, completed_at, content, error, cards, cards_status, created_at, is_test, email`;

const birthOf = (r: Pick<Row, "birth_date" | "birth_time">): Birth => {
  const [y, m, d] = r.birth_date.split("-").map(Number);
  const [h, mi] = r.birth_time ? r.birth_time.split(":").map(Number) : [null, null];
  return { year: y, month: m, day: d, hour: h, minute: mi, iso: r.birth_date, time: r.birth_time };
};

/** 리포트를 볼 해(오늘 기준 앞뒤 5년) */
function yearsAround(now: Date) {
  const y0 = now.getUTCFullYear();
  return { y0, list: Array.from({ length: 10 }, (_, i) => y0 - 5 + i) };
}

export function buildPrompt(r: Pick<Row, "name" | "birth_date" | "birth_time" | "gender">, now = new Date()): { prompt: string; chart: FullChart } {
  const b = birthOf(r);
  const { y0, list } = yearsAround(now);
  const chart = fullChart(b, r.gender, list, y0);
  const tpl = (PROMPTS.reading ?? "").replace(/^<!--[\s\S]*?-->\s*/, "");
  const vars: Record<string, string> = {
    chart: chartText(chart, r.name, { iso: b.iso, time: b.time }, r.gender, y0),
    name: r.name,
    today: now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" }),
    now_ym: now.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "America/New_York" }),
    yp5: String(y0 - 5), yp1: String(y0 - 1), y0: String(y0), y4: String(y0 + 4),
    cur_ages: chart.current ? `Ages ${chart.current.cycle.startAge}-${chart.current.cycle.endAge}` : "Before Your First Cycle",
  };
  return { prompt: tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? ""), chart };
}

export async function createReading(
  input: { name: unknown; birthday: unknown; time?: unknown; timeUnknown?: unknown; gender: unknown; email?: unknown },
  ip: string, start: (fn: () => Promise<unknown>) => void,
) {
  const mode = readingsMode();
  if (mode !== "test") throw new HttpError(403, "CHECKOUT_CLOSED", { error: "CHECKOUT_CLOSED", message: "Checkout isn't open yet. Reserve your reading and we'll email you." });
  const name = cleanName(input.name, "your name");
  const timeUnknown = input.timeUnknown === true;
  const b = parseBirthday(input.birthday, timeUnknown ? "" : input.time);
  if (!timeUnknown && !b.time) throw new HttpError(400, "NEED_TIME", { error: "NEED_TIME", message: "Add your birth time, or check \"I don't know my birth time\"." });
  const gender = parseGender(input.gender);
  // 이메일은 선택: 리포트 화면에서 "다시 보려면 저장"으로 받는다
  const email = str(input.email) ? cleanEmail(input.email) : null;
  const sql = getSql();
  const ipHash = hashIp(ip);
  const cap = Math.max(0, Number(envOptional("TEST_DAILY_CAP") ?? 10) || 10);
  const [{ today }] = await sql<{ today: number }[]>`select count(*)::int today from readings where is_test and created_at > now() - interval '1 day'`;
  if (today >= cap) throw new HttpError(429, "DAILY_CAP", { error: "DAILY_CAP", message: "Today's free preview readings are all taken. Try again tomorrow." });
  if (ipHash) {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from readings where ip_hash = ${ipHash} and created_at > now() - interval '1 day'`;
    if (n >= PER_IP_PER_DAY) throw new HttpError(429, "TOO_MANY", { error: "TOO_MANY", message: "You've made 3 readings today. Try again tomorrow." });
  }
  const key = randomBytes(18).toString("base64url");
  const [row] = await sql<{ id: string }[]>`
    insert into readings (view_key, email, name, birth_date, birth_time, time_unknown, gender, sign_key, prompt_version, ip_hash, is_test)
    values (${key}, ${email}, ${name}, ${b.iso}, ${b.time}, ${timeUnknown}, ${gender}, ${signOf(b).key}, ${PROMPT_VERSION}, ${ipHash}, true)
    returning id`;
  await track("reading_created", { ref: mode, isTest: true });
  start(() => notify(`🧪 무료 리포트 생성 시작: <b>${escHtml(name)}</b> (${gender}, ${b.iso}${b.time ? " " + b.time : ""})`));
  start(() => generateReading(row.id));
  return { id: row.id, key };
}

/** 글 생성. 다른 요청이 이미 만드는 중이면(6분 이내) 손대지 않는다 */
export async function generateReading(id: string): Promise<void> {
  const sql = getSql();
  const [r] = await sql<Row[]>`
    update readings set attempts = attempts + 1, started_at = now(), error = null
     where id = ${id} and status = 'generating' and attempts < ${MAX_ATTEMPTS}
       and (started_at is null or started_at < now() - make_interval(mins => ${STALE_MIN}))
    returning ${sql.unsafe(COLS)}`;
  if (!r) return;
  try {
    const { prompt } = buildPrompt(r);
    const content = (await services().ai.generate(MODEL, prompt)).trim();
    if (content.length < 500 || !content.includes("##")) throw new Error("REPORT_TOO_SHORT");
    await sql`update readings set status = 'done', content = ${content}, completed_at = now(), cards = null, cards_status = null where id = ${id} and status = 'generating'`;
    await mailReadingReady(r).catch((e) => console.error("[reading mail]", id, e instanceof Error ? e.message : e));
    await track("reading_done", { isTest: r.is_test });
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error("[reading]", id, msg);
    const [f] = await sql<{ status: string }[]>`update readings set error = ${msg}, started_at = null,
              status = case when attempts >= ${MAX_ATTEMPTS} then 'failed' else status end
              where id = ${id} and status = 'generating' returning status`;
    if (f?.status === "failed") {
      await track("reading_failed", { isTest: r.is_test });
      await notify(`⚠️ 리포트 최종 실패 (${MAX_ATTEMPTS}번 시도): <b>${escHtml(r.name)}</b>\n${escHtml(msg.slice(0, 200))}\nid ${id}`);
    } else await notify(`↻ 리포트 생성 실패, 다시 시도 예정 (${r.attempts}/${MAX_ATTEMPTS}): ${escHtml(msg.slice(0, 120))}`);
    return;
  }
  await generateCards(id);
}

export async function generateCards(id: string): Promise<void> {
  const sql = getSql();
  // 5분 넘게 '만드는 중'이면 끊긴 것: 실패로 (글 화면은 그대로 보인다)
  await sql`update readings set cards_status = 'failed' where id = ${id} and cards_status = 'generating' and cards_at < now() - interval '5 minutes'`;
  const [r] = await sql<{ content: string }[]>`
    update readings set cards_status = 'generating', cards_at = now()
     where id = ${id} and status = 'done' and content is not null and cards_status is null returning content`;
  if (!r) return;
  try {
    const cards = await extractCards(r.content);
    await sql`update readings set cards = ${sql.json(cards as never)}, cards_status = 'done', cards_at = now() where id = ${id} and content = ${r.content}`;
  } catch (e) {
    console.error("[cards]", id, e);
    await sql`update readings set cards_status = 'failed', cards_at = now() where id = ${id}`;
  }
}

/** 보기 (링크의 비밀 키가 맞을 때만). 멈춰 있으면 다시 시작해 둔다 */
export async function viewReading(id: string, key: string, start: (fn: () => Promise<unknown>) => void) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !key) throw new HttpError(404, "NOT_FOUND");
  const [r] = await getSql()<Row[]>`select ${getSql().unsafe(COLS)} from readings where id = ${id}`;
  if (!r || createHash("sha256").update(r.view_key).digest("hex") !== createHash("sha256").update(key).digest("hex")) {
    throw new HttpError(404, "NOT_FOUND", { error: "NOT_FOUND", message: "This reading doesn't exist." });
  }
  const b = birthOf(r);
  const { chart } = buildPrompt(r);
  const base = {
    id: r.id, name: r.name, birthday: b.iso, time: b.time, gender: r.gender, created: r.created_at.toISOString(),
    savedEmail: r.email ? maskEmail(r.email) : null,
    chart: { sign: chart.sign, pillars: chart.pillars, elements: chart.elements, hidden: chart.hidden, hiddenSpots: chart.hiddenSpots, luck: chart.luck, current: chart.current, match: chart.match },
  };
  if (r.status === "generating") {
    const stale = !r.started_at || Date.now() - r.started_at.getTime() > STALE_MIN * 60_000;
    if (stale && r.attempts < MAX_ATTEMPTS) start(() => generateReading(r.id));
    return { status: "generating" as const, ...base };
  }
  if (r.status === "failed") return { status: "failed" as const, ...base };
  if (!r.cards_status) start(() => generateCards(r.id));
  return {
    status: "done" as const, ...base, text: r.content!,
    cards: r.cards_status === "done" ? r.cards : null,
    cardsPending: r.cards_status === null || r.cards_status === "generating",
  };
}

/** 리포트 화면에서 "다시 보려면 이메일 저장": 링크의 비밀 키가 맞을 때만. 저장하면 리포트 링크를 메일로 보낸다 */
export async function saveReadingEmail(id: string, key: string, emailIn: unknown) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !key) throw new HttpError(404, "NOT_FOUND");
  const sql = getSql();
  const [r] = await sql<{ id: string; view_key: string; name: string; email: string | null; is_test: boolean; status: string }[]>`select id, view_key, name, email, is_test, status from readings where id = ${id}`;
  if (!r || createHash("sha256").update(r.view_key).digest("hex") !== createHash("sha256").update(key).digest("hex")) throw new HttpError(404, "NOT_FOUND");
  const email = cleanEmail(emailIn);
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from email_outbox where kind = 'reading_ready' and to_email = ${email} and created_at > now() - interval '1 hour'`;
  if (n >= 5) throw new HttpError(429, "TOO_MANY", { error: "TOO_MANY", message: "We already sent this a few times. Check your inbox and spam." });
  await sql`update readings set email = ${email} where id = ${id}`;
  // 이미 다 쓴 리포트면 지금 링크를 보낸다 (아직 쓰는 중이면 다 쓴 뒤 자동으로 감)
  if (r.status === "done") await mailReadingReady({ ...r, email });
  await track("reading_email_saved", { isTest: r.is_test });
  return { saved: true, email: maskEmail(email) };
}
