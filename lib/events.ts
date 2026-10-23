// 방문·공유 통계 (쿠키 없음). 화면에서 오는 이벤트는 정해진 이름만 받는다. 기록 실패가 손님 요청을 막지 않는다.
import { createHash } from "node:crypto";
import { getSql } from "./db";
import { envOptional } from "./env";
import { str } from "./http";

/** 화면에서 보낼 수 있는 이벤트 */
export const CLIENT_EVENTS = [
  "page_view",        // page: landing | guest | owner | reading_form | reading | find | legal
  "sign_revealed",    // 첫 화면에서 사인 보기
  "share_click",      // ref: native | copy | facebook | whatsapp | text | x
  "story_image",      // ref: sign | match | page
  "upsell_click",     // ref: guest_card | dock | landing | owner
  "own_page_click",   // 친구가 결과 보고 "내 페이지 만들기"
  "private_link_copy",
] as const;
/** 서버에서 기록하는 이벤트 */
export type ServerEvent = "map_created" | "entry_added" | "reading_created" | "reading_done" | "reading_failed"
  | "page_email_saved" | "reading_email_saved" | "login_requested" | "login_used";

const day = () => new Date().toISOString().slice(0, 10);
export function visitorOf(req: Request): string | null {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (!ip) return null;
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 200);
  return createHash("sha256").update(`${envOptional("IP_SALT") ?? "withsaju"}:${day()}:${ip}:${ua}`).digest("hex").slice(0, 16);
}

export async function track(name: ServerEvent | (typeof CLIENT_EVENTS)[number], o: { page?: string | null; ref?: string | null; src?: string | null; visitor?: string | null; isTest?: boolean } = {}) {
  try {
    await getSql()`insert into events (name, page, ref, src, visitor, is_test)
      values (${name}, ${o.page ?? null}, ${o.ref ?? null}, ${o.src ?? null}, ${o.visitor ?? null}, ${o.isTest ?? false})`;
  } catch (e) { console.error("[events]", e instanceof Error ? e.message : e); }
}

const clean = (v: unknown, n: number) => { const s = str(v, n).toLowerCase().replace(/[^a-z0-9_.:-]/g, ""); return s || null; };
/** 화면 이벤트 받기 */
export async function trackClient(req: Request, body: Record<string, unknown>) {
  const name = str(body.n, 40);
  if (!(CLIENT_EVENTS as readonly string[]).includes(name)) return { ok: false };
  await track(name as (typeof CLIENT_EVENTS)[number], { page: clean(body.p, 40), ref: clean(body.r, 60), src: clean(body.s, 80), visitor: visitorOf(req) });
  return { ok: true };
}

export interface Stats {
  days: { day: string; visitors: number; views: number; signs: number; maps: number; entries: number; shares: number; ownFromGuest: number; upsell: number; readings: number; readingsFailed: number; emails: number }[];
  pages: { page: string; views: number }[];
  sources: { src: string; visitors: number }[];
  shares: { ref: string; n: number }[];
  totals: { maps: number; entries: number; readings: number; entriesPerMap: number };
}

/** 최근 N일 통계 (한국 시간 기준 날짜) */
export async function stats(days = 7): Promise<Stats> {
  const sql = getSql();
  const tz = "Asia/Seoul";
  const rows = await sql<Stats["days"]>`
    select to_char(d, 'YYYY-MM-DD') as day,
      (select count(distinct visitor)::int from events e where e.name = 'page_view' and (e.created_at at time zone ${tz})::date = d) visitors,
      (select count(*)::int from events e where e.name = 'page_view' and (e.created_at at time zone ${tz})::date = d) views,
      (select count(*)::int from events e where e.name = 'sign_revealed' and (e.created_at at time zone ${tz})::date = d) signs,
      (select count(*)::int from events e where e.name = 'map_created' and (e.created_at at time zone ${tz})::date = d) maps,
      (select count(*)::int from events e where e.name = 'entry_added' and (e.created_at at time zone ${tz})::date = d) entries,
      (select count(*)::int from events e where e.name in ('share_click', 'story_image') and (e.created_at at time zone ${tz})::date = d) shares,
      (select count(*)::int from events e where e.name = 'own_page_click' and (e.created_at at time zone ${tz})::date = d) "ownFromGuest",
      (select count(*)::int from events e where e.name = 'upsell_click' and (e.created_at at time zone ${tz})::date = d) upsell,
      (select count(*)::int from events e where e.name = 'reading_created' and (e.created_at at time zone ${tz})::date = d) readings,
      (select count(*)::int from events e where e.name = 'reading_failed' and (e.created_at at time zone ${tz})::date = d) "readingsFailed",
      (select count(*)::int from events e where e.name in ('page_email_saved', 'reading_email_saved') and (e.created_at at time zone ${tz})::date = d) emails
    from generate_series((now() at time zone ${tz})::date - (${days - 1})::int, (now() at time zone ${tz})::date, interval '1 day') d
    order by d desc`;
  const since = sql`now() - make_interval(days => ${days})`;
  const pages = await sql<Stats["pages"]>`select coalesce(page, '?') page, count(*)::int views from events where name = 'page_view' and created_at > ${since} group by 1 order by 2 desc limit 10`;
  const sources = await sql<Stats["sources"]>`select coalesce(src, 'direct') src, count(distinct visitor)::int visitors from events where name = 'page_view' and created_at > ${since} group by 1 order by 2 desc limit 10`;
  const shares = await sql<Stats["shares"]>`select coalesce(ref, '?') ref, count(*)::int n from events where name in ('share_click', 'story_image') and created_at > ${since} group by 1 order by 2 desc limit 10`;
  const [t] = await sql<{ maps: number; entries: number; readings: number }[]>`select
    (select count(*)::int from maps where not is_test) maps,
    (select count(*)::int from map_entries e join maps m on m.id = e.map_id where not m.is_test and e.removed_at is null) entries,
    (select count(*)::int from readings) readings`;
  return { days: rows, pages, sources, shares, totals: { ...t, entriesPerMap: t.maps ? Math.round((t.entries / t.maps) * 10) / 10 : 0 } };
}
