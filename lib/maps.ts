// 친구 지도: 만들기 · 보기 · 친구 올리기 · 주인이 지우기
import { createHash, randomBytes } from "node:crypto";
import { getSql } from "./db";
import { HttpError, str } from "./http";
import { envOptional } from "./env";
import { relationOf, signOf, type KoreanSign, type RelationKind } from "./saju";
import { track } from "./events";

export const MAX_ENTRIES = 200;
const MAPS_PER_IP_PER_DAY = 20;
const ENTRIES_PER_IP_PER_HOUR = 5;

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const hashIp = (ip: string) => (ip ? sha(`${envOptional("IP_SALT") ?? "withsaju"}:${ip}`) : null);
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
}

export interface Birth { year: number; month: number; day: number; hour: number | null; minute: number | null; iso: string; time: string | null }

/** "YYYY-MM-DD" (+ 선택 "HH:MM") → 생일 (1920–올해) */
export function parseBirthday(v: unknown, t?: unknown): Birth {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(v, 10));
  if (!m) throw new HttpError(400, "BAD_BIRTHDAY", { error: "BAD_BIRTHDAY", message: "Enter a valid birthday." });
  const ts = str(t, 5);
  const tm = ts ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(ts) : null;
  if (ts && !tm) throw new HttpError(400, "BAD_TIME", { error: "BAD_TIME", message: "Enter a valid birth time, or leave it empty." });
  const b = { year: +m[1], month: +m[2], day: +m[3], hour: tm ? +tm[1] : null, minute: tm ? +tm[2] : null };
  const thisYear = new Date().getUTCFullYear();
  try {
    if (b.year < 1920 || b.year > thisYear) throw 0;
    signOf(b);
  } catch {
    throw new HttpError(400, "BAD_BIRTHDAY", { error: "BAD_BIRTHDAY", message: "Enter a valid birthday." });
  }
  return { ...b, iso: m[0], time: tm ? tm[0] : null };
}

export function cleanName(v: unknown, field: string): string {
  // 제어 문자·꺾쇠 제거, 공백 정리
  const s = str(v, 60).replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
  if (!s) throw new HttpError(400, "BAD_NAME", { error: "BAD_NAME", message: `Enter ${field}.` });
  return s;
}

/** 오행 개수 (기둥 글자 6~8개) — 오각형 그래프용 */
export function elementsOfSign(s: KoreanSign): Record<string, number> {
  const out: Record<string, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  for (const p of [s.pillars.year, s.pillars.month, s.pillars.day, s.pillars.hour]) {
    if (!p) continue;
    out[p.stemElement]++; out[p.branchElement]++;
  }
  return out;
}

/** 본인에게만: 네 기둥·태양 황경까지 */
export function publicSign(s: KoreanSign) {
  return {
    elements: elementsOfSign(s),
    key: s.key, name: s.name, hanja: s.hanja, tagline: s.tagline, element: s.element, yang: s.yang,
    season: s.season, strength: s.strength, dayPillar: s.dayPillar, zodiac: s.zodiac, sunLongitude: s.sunLongitude,
    pillars: s.pillars, animal: s.animal, title: s.title, hidden: s.hidden, hiddenSpots: s.hiddenSpots,
  };
}

/** 다른 사람에게 보여 줄 때: 생일을 거꾸로 알아낼 수 있는 값(기둥·황경)은 뺀다 */
export function sharedSign(s: KoreanSign) {
  return { key: s.key, name: s.name, hanja: s.hanja, tagline: s.tagline, element: s.element, yang: s.yang, season: s.season, strength: s.strength, zodiac: s.zodiac, elements: elementsOfSign(s), hidden: s.hidden, animal: s.animal, title: s.title };
}

const newSlug = () => {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  const b = randomBytes(10);
  return Array.from(b, (x) => abc[x % abc.length]).join("");
};

export async function createMap(input: { name: unknown; birthday: unknown; time?: unknown }, ip: string, isTest = false) {
  const name = cleanName(input.name, "your name");
  const b = parseBirthday(input.birthday, input.time);
  const sign = signOf(b);
  const sql = getSql();
  const ipHash = hashIp(ip);
  if (ipHash) {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from maps where ip_hash = ${ipHash} and created_at > now() - interval '1 day'`;
    if (n >= MAPS_PER_IP_PER_DAY) throw new HttpError(429, "TOO_MANY", { error: "TOO_MANY", message: "Too many maps today. Try again tomorrow." });
  }
  const ownerToken = randomBytes(24).toString("base64url");
  const slug = newSlug();
  await sql`insert into maps (slug, owner_token_hash, name, birth_date, birth_time, sign_key, ip_hash, is_test)
            values (${slug}, ${sha(ownerToken)}, ${name}, ${b.iso}, ${b.time}, ${sign.key}, ${ipHash}, ${isTest})`;
  await track("map_created", { isTest });
  return { slug, ownerToken, name, sign: publicSign(sign) };
}

interface MapRow { id: string; slug: string; owner_token_hash: string; name: string; birth_date: string; birth_time: string | null; owner_email: string | null }

async function loadMap(slugIn: string): Promise<MapRow> {
  const slug = slugIn.toLowerCase();
  if (!/^[a-z0-9]{10}$/.test(slug)) throw new HttpError(404, "MAP_NOT_FOUND");
  const [m] = await getSql()<MapRow[]>`select id, slug, owner_token_hash, name, to_char(birth_date, 'YYYY-MM-DD') birth_date, to_char(birth_time, 'HH24:MI') birth_time, owner_email from maps where slug = ${slug}`;
  if (!m) throw new HttpError(404, "MAP_NOT_FOUND", { error: "MAP_NOT_FOUND", message: "This map doesn't exist." });
  return m;
}
const signOfIso = (iso: string, time: string | null) => {
  const [y, m, d] = iso.split("-").map(Number);
  const [h, mi] = time ? time.split(":").map(Number) : [null, null];
  return signOf({ year: y, month: m, day: d, hour: h, minute: mi });
};
/** 주인 확인: 처음 만든 기기의 열쇠, 또는 이메일 링크로 받은 기기별 열쇠 */
async function isOwner(m: MapRow, token: string): Promise<boolean> {
  if (!token) return false;
  const h = sha(token);
  if (h === m.owner_token_hash) return true;
  const [k] = await getSql()`select 1 from map_keys where map_id = ${m.id} and token_hash = ${h}`;
  return !!k;
}
/** a***@gmail.com */
export const maskEmail = (e: string) => { const [u, d] = e.split("@"); return `${u.slice(0, 1)}${"*".repeat(Math.max(1, Math.min(4, u.length - 1)))}@${d}`; };
export { loadMap, isOwner };

/** 지도 보기. 생일은 누구에게도 돌려주지 않는다 (별명·타입·관계만) */
export async function viewMap(slug: string, ownerToken: string) {
  const m = await loadMap(slug);
  const owner = signOfIso(m.birth_date, m.birth_time);
  const rows = await getSql()<{ id: string; nickname: string; birth_date: string; birth_time: string | null; relation: RelationKind; score: number; created_at: Date }[]>`
    select id, nickname, to_char(birth_date, 'YYYY-MM-DD') birth_date, to_char(birth_time, 'HH24:MI') birth_time, relation, score, created_at
      from map_entries where map_id = ${m.id} and removed_at is null order by score desc, created_at asc limit ${MAX_ENTRIES}`;
  const entries = rows.map((r) => {
    const s = signOfIso(r.birth_date, r.birth_time);
    return { id: r.id, nickname: r.nickname, sign: { name: s.name, hanja: s.hanja, element: s.element }, relation: r.relation, score: r.score };
  });
  const own = await isOwner(m, ownerToken);
  return { slug: m.slug, name: m.name, sign: own ? publicSign(owner) : sharedSign(owner), entries, isOwner: own, ...(own ? { savedEmail: m.owner_email ? maskEmail(m.owner_email) : null } : {}) };
}

/** 친구가 생일을 넣는다. 지도에 올리기는 동의했을 때만 (안 해도 결과는 본다) */
export async function addEntry(slug: string, input: { nickname: unknown; birthday: unknown; time?: unknown; consent: unknown }, ip: string, isTest = false) {
  const m = await loadMap(slug);
  const nickname = cleanName(input.nickname, "a nickname");
  const b = parseBirthday(input.birthday, input.time);
  const owner = signOfIso(m.birth_date, m.birth_time), friend = signOf(b);
  const rel = relationOf(owner, friend);
  let added = false;
  if (input.consent === true) {
    const sql = getSql();
    const ipHash = hashIp(ip);
    await sql.begin(async (tx) => {
      // 같은 지도에 동시에 여러 명이 올려도 개수 제한이 지켜지게 지도 행을 잠근다
      await tx`select 1 from maps where id = ${m.id} for update`;
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int n from map_entries where map_id = ${m.id} and removed_at is null`;
      if (n >= MAX_ENTRIES) throw new HttpError(409, "MAP_FULL", { error: "MAP_FULL", message: "This map is full." });
      if (ipHash) {
        const [{ k }] = await tx<{ k: number }[]>`select count(*)::int k from map_entries where map_id = ${m.id} and ip_hash = ${ipHash} and created_at > now() - interval '1 hour'`;
        if (k >= ENTRIES_PER_IP_PER_HOUR) throw new HttpError(429, "TOO_MANY", { error: "TOO_MANY", message: "Too many entries from you. Try again later." });
      }
      await tx`insert into map_entries (map_id, nickname, birth_date, birth_time, sign_key, relation, score, ip_hash, is_test)
               values (${m.id}, ${nickname}, ${b.iso}, ${b.time}, ${friend.key}, ${rel.kind}, ${rel.score}, ${ipHash}, ${isTest})`;
    });
    added = true;
  }
  await track("entry_added", { ref: added ? "on_map" : "private", isTest });
  return { added, sign: publicSign(friend), relation: rel, owner: { name: m.name, sign: sharedSign(owner) } };
}

export async function removeEntry(slug: string, entryId: string, ownerToken: string) {
  const m = await loadMap(slug);
  if (!(await isOwner(m, ownerToken))) throw new HttpError(403, "NOT_OWNER");
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) throw new HttpError(400, "BAD_ID");
  const r = await getSql()`update map_entries set removed_at = now() where id = ${entryId} and map_id = ${m.id} and removed_at is null returning id`;
  if (!r.length) throw new HttpError(404, "ENTRY_NOT_FOUND");
  return { removed: true };
}
