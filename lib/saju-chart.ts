// 상세 리포트용 사주 원국 계산: 네 기둥 + 십신 + 오행 개수 + 대운 + 세운.
// AI는 해석만 하고, 숫자·글자는 전부 여기서 계산해 넘긴다 (AI가 만세력을 지어내지 않게).
import { MakeTime, SearchSunLongitude } from "astronomy-engine";
import {
  BRANCH_ELEMENT, BRANCH_H, BRANCH_ROMAN, CHECKS, FEEDS, SEASON_ELEMENT, STEM_ELEMENT, STEM_H, STEM_ROMAN, STEM_TYPE,
  chartOf, signOf, type BirthInput, type Element, type Pillar, type Season,
} from "./saju";

export type Gender = "woman" | "man";

export const BRANCH_ANIMAL = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
/** 지지의 본기(주된 지장간) */
export const BRANCH_MAIN_STEM = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];

export const TEN_GOD = {
  companion: "Companion (比肩)", rob: "Rob Wealth (劫財)", eating: "Eating God (食神)", hurting: "Hurting Officer (傷官)",
  indirectWealth: "Indirect Wealth (偏財)", directWealth: "Direct Wealth (正財)", sevenKillings: "Seven Killings (偏官)",
  directOfficer: "Direct Officer (正官)", indirectResource: "Indirect Resource (偏印)", directResource: "Direct Resource (正印)",
} as const;
export type TenGod = keyof typeof TEN_GOD;

/** 일간 기준 다른 천간의 십신 */
export function tenGodOf(dayStem: number, other: number): TenGod {
  const a = STEM_ELEMENT[dayStem], b = STEM_ELEMENT[other], same = dayStem % 2 === other % 2;
  if (a === b) return same ? "companion" : "rob";
  if (FEEDS[a] === b) return same ? "eating" : "hurting";
  if (CHECKS[a] === b) return same ? "indirectWealth" : "directWealth";
  if (CHECKS[b] === a) return same ? "sevenKillings" : "directOfficer";
  return same ? "indirectResource" : "directResource"; // FEEDS[b] === a
}

const mod = (n: number, k: number) => ((n % k) + k) % k;
export const yearPillarOf = (y: number): Pillar => ({ stem: mod(y - 4, 10), branch: mod(y - 4, 12) });

export interface PillarDetail {
  han: string; roman: string;
  stem: { han: string; element: Element; yang: boolean; tenGod: TenGod | "self" };
  branch: { han: string; animal: string; element: Element; tenGod: TenGod };
}
function detail(p: Pillar, dayStem: number, isDay = false): PillarDetail {
  return {
    han: STEM_H[p.stem] + BRANCH_H[p.branch],
    roman: `${STEM_ROMAN[p.stem]}-${BRANCH_ROMAN[p.branch]}`,
    stem: { han: STEM_H[p.stem], element: STEM_ELEMENT[p.stem], yang: p.stem % 2 === 0, tenGod: isDay ? "self" : tenGodOf(dayStem, p.stem) },
    branch: { han: BRANCH_H[p.branch], animal: BRANCH_ANIMAL[p.branch], element: BRANCH_ELEMENT[p.branch], tenGod: tenGodOf(dayStem, BRANCH_MAIN_STEM[p.branch]) },
  };
}

/** 십신을 쉬운 말로 (화면용) */
export const TEN_GOD_PLAIN: Record<TenGod, string> = {
  companion: "peers, independence, standing your ground",
  rob: "rivals, bold moves, money going out",
  eating: "creativity, enjoyment, steady output",
  hurting: "self-expression, breaking rules, talent on show",
  indirectWealth: "big opportunities, deals, risk",
  directWealth: "steady income, managing what you have",
  sevenKillings: "pressure, challenges, raw ambition",
  directOfficer: "status, rules, responsibility",
  indirectResource: "intuition, unusual learning, solitude",
  directResource: "support, study, protection",
};

const ELEMENT_SEASON: Record<Element, Season | null> = { Wood: "Spring", Fire: "Summer", Metal: "Autumn", Water: "Winter", Earth: null };
const ORDER: Element[] = ["Wood", "Fire", "Earth", "Metal", "Water"];

export interface MatchSign { name: string; hanja: string; element: Element; why: string }
/** 나에게 맞는 사람: 원국에 부족한 오행(+ 약한 일간이면 일간을 생해 주는 오행)을 가진 일간 */
export function matchesFor(elements: Record<Element, number>, dayStem: number, strength: "peak" | "fed" | "off"): { needs: Element[]; signs: MatchSign[] } {
  const dm = STEM_ELEMENT[dayStem];
  const feeder = ORDER.find((e) => FEEDS[e] === dm)!;
  const min = Math.min(...ORDER.map((e) => elements[e]));
  const prio = (e: Element) => (e === feeder ? 0 : e === dm ? 1 : 2);
  const needs: Element[] = ORDER.filter((e) => elements[e] === min).sort((a, b) => prio(a) - prio(b)).slice(0, 2);
  if (strength === "off" && !needs.includes(feeder)) needs.splice(1, 1, feeder);
  const signs: MatchSign[] = [];
  for (const e of needs.slice(0, 2)) {
    const season = ELEMENT_SEASON[e] ?? (["Summer", "Autumn"] as Season[])[signs.length % 2];
    for (const stem of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => STEM_ELEMENT[x] === e)) {
      const why = elements[e] === 0 ? `Brings the ${e.toLowerCase()} your chart is missing.`
        : e === feeder ? `${e} feeds your ${dm.toLowerCase()} Day Master and steadies you.`
        : `Adds the ${e.toLowerCase()} your chart runs short on.`;
      signs.push({ name: `${season} ${STEM_TYPE[stem].name}`, hanja: STEM_H[stem], element: e, why });
    }
  }
  return { needs, signs: signs.slice(0, 4) };
}

export interface LuckCycle { startAge: number; endAge: number; startYear: number; pillar: PillarDetail }
export interface FullChart {
  sign: ReturnType<typeof signOf>;
  pillars: { year: PillarDetail; month: PillarDetail; day: PillarDetail; hour: PillarDetail | null };
  elements: Record<Element, number>;
  luck: { forward: boolean; startAge: number; cycles: LuckCycle[] };
  years: { year: number; pillar: PillarDetail }[];
  /** 지금 대운: 원국에 이 대운 두 글자를 더하면 오행이 어떻게 바뀌는지 */
  current: { cycle: LuckCycle; withCycle: Record<Element, number>; plain: [string, string] } | null;
  match: { needs: Element[]; signs: MatchSign[] };
}

/** 대운: 양년생 남자·음년생 여자는 순행, 반대는 역행. 시작 나이 = 절입까지 날수 ÷ 3 */
function luckCycles(b: BirthInput, gender: Gender, year: Pillar, month: Pillar, instant: Date, lon: number, dayStem: number) {
  const yangYear = year.stem % 2 === 0;
  const forward = (yangYear && gender === "man") || (!yangYear && gender === "woman");
  // 이 달을 연 절기(황경 15°+30°k)와 다음 절기
  const prevTerm = mod(15 + 30 * Math.floor((lon - 15) / 30), 360);
  const target = forward ? mod(prevTerm + 30, 360) : prevTerm;
  const from = forward ? instant : new Date(instant.getTime() - 35 * 86400_000);
  const hit = SearchSunLongitude(target, MakeTime(from), 40);
  const days = hit ? Math.abs(hit.date.getTime() - instant.getTime()) / 86400_000 : 15;
  const startAge = Math.max(1, Math.round(days / 3));
  const cycles: LuckCycle[] = [];
  for (let k = 1; k <= 9; k++) {
    const p = { stem: mod(month.stem + (forward ? k : -k), 10), branch: mod(month.branch + (forward ? k : -k), 12) };
    const startA = startAge + (k - 1) * 10;
    cycles.push({ startAge: startA, endAge: startA + 9, startYear: b.year + startA, pillar: detail(p, dayStem) });
  }
  return { forward, startAge, cycles };
}

export function fullChart(b: BirthInput, gender: Gender, years: number[], nowYear = new Date().getUTCFullYear()): FullChart {
  const c = chartOf(b);
  const ds = c.day.stem;
  const pillars = { year: detail(c.year, ds), month: detail(c.month, ds), day: detail(c.day, ds, true), hour: c.hour ? detail(c.hour, ds) : null };
  const elements: Record<Element, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  for (const p of [c.year, c.month, c.day, c.hour]) {
    if (!p) continue;
    elements[STEM_ELEMENT[p.stem]]++; elements[BRANCH_ELEMENT[p.branch]]++;
  }
  const sign = signOf(b);
  const luck = luckCycles(b, gender, c.year, c.month, c.instant, c.sunLongitude, ds);
  const age = nowYear - b.year;
  const cyc = luck.cycles.find((x) => age >= x.startAge && age <= x.endAge) ?? null;
  let current: FullChart["current"] = null;
  if (cyc) {
    const withCycle = { ...elements };
    withCycle[cyc.pillar.stem.element]++; withCycle[cyc.pillar.branch.element]++;
    current = { cycle: cyc, withCycle, plain: [TEN_GOD_PLAIN[cyc.pillar.stem.tenGod as TenGod], TEN_GOD_PLAIN[cyc.pillar.branch.tenGod]] };
  }
  return {
    sign, pillars, elements, luck,
    years: years.map((y) => ({ year: y, pillar: detail(yearPillarOf(y), ds) })),
    current, match: matchesFor(elements, ds, sign.strength),
  };
}

/** AI에게 넘길 원국 설명 (영어). 계산값을 그대로 적는다 */
export function chartText(ch: FullChart, name: string, birth: { iso: string; time: string | null }, gender: Gender, nowYear: number): string {
  const line = (label: string, p: PillarDetail | null) => p
    ? `- ${label}: ${p.han} (${p.roman}). Stem ${p.stem.han} = ${p.stem.yang ? "Yang" : "Yin"} ${p.stem.element}${p.stem.tenGod === "self" ? " = DAY MASTER" : `, ${TEN_GOD[p.stem.tenGod as TenGod]}`}. Branch ${p.branch.han} = ${p.branch.animal}, ${p.branch.element}, ${TEN_GOD[p.branch.tenGod]}.`
    : `- ${label}: unknown (birth time not given). Do not make any claim based on the hour pillar.`;
  const age = (y: number) => y - Number(birth.iso.slice(0, 4));
  const cur = ch.luck.cycles.find((x) => age(nowYear) >= x.startAge && age(nowYear) <= x.endAge);
  return [
    `SAJU CHART (computed exactly by the server; use these values as given, do not recalculate or invent any)`,
    `Name: ${name} | Gender: ${gender} | Born: ${birth.iso}${birth.time ? ` ${birth.time} local time` : " (birth time unknown)"}`,
    `Western zodiac sign (for reference only): ${ch.sign.zodiac}`,
    `Four pillars (Heavenly Stem over Earthly Branch; ten gods are relative to the Day Master):`,
    line("Year pillar (family background, generation)", ch.pillars.year),
    line("Month pillar (season of birth, environment, career base)", ch.pillars.month),
    line("Day pillar (the self; the branch is the partner palace)", ch.pillars.day),
    line("Hour pillar (inner self, later life, children)", ch.pillars.hour),
    `Day Master: ${ch.sign.hanja} = ${ch.sign.yang ? "Yang" : "Yin"} ${ch.sign.element}. Born in ${ch.sign.season}; seasonal strength: ${ch.sign.strength === "peak" ? "in season (strong)" : ch.sign.strength === "fed" ? "fed by the season (supported)" : "off season (weaker, needs support)"}.`,
    `Five elements count across the ${ch.pillars.hour ? "8" : "6"} characters: ${Object.entries(ch.elements).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
    `10-year luck cycles (${ch.luck.forward ? "forward" : "backward"}, first cycle starts at age ${ch.luck.startAge}):`,
    ...ch.luck.cycles.map((x) => `- Ages ${x.startAge}-${x.endAge} (from ${x.startYear}): ${x.pillar.han} (${x.pillar.stem.element} ${TEN_GOD[x.pillar.stem.tenGod as TenGod]} / ${x.pillar.branch.animal} ${x.pillar.branch.element} ${TEN_GOD[x.pillar.branch.tenGod]})${x === cur ? "  <- CURRENT CYCLE" : ""}`),
    ch.current ? `Current 10-year cycle energy (ages ${ch.current.cycle.startAge}-${ch.current.cycle.endAge}): stem brings ${TEN_GOD_PLAIN[ch.current.cycle.pillar.stem.tenGod as TenGod]}; branch brings ${ch.current.plain[1]}. Element balance with this cycle added: ${Object.entries(ch.current.withCycle).map(([k, v]) => `${k} ${v}`).join(", ")}.` : `Current 10-year cycle: not started yet (childhood).`,
    `Compatible types (computed from the element balance): this chart needs ${ch.match.needs.join(" and ")}. Recommended Korean signs: ${ch.match.signs.map((x) => `${x.name} (${x.hanja}, ${x.element}): ${x.why}`).join("; ")}.`,
    `Yearly pillars:`,
    ...ch.years.map((y) => `- ${y.year} (age ${age(y.year)}): ${y.pillar.han} (${y.pillar.stem.element} ${TEN_GOD[y.pillar.stem.tenGod as TenGod]} / ${y.pillar.branch.animal} ${y.pillar.branch.element} ${TEN_GOD[y.pillar.branch.tenGod]})`),
  ].join("\n");
}
