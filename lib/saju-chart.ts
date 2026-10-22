// 상세 리포트용 사주 원국 계산: 네 기둥 + 십신 + 오행 개수 + 대운 + 세운.
// AI는 해석만 하고, 숫자·글자는 전부 여기서 계산해 넘긴다 (AI가 만세력을 지어내지 않게).
import { MakeTime, SearchSunLongitude } from "astronomy-engine";
import {
  BRANCH_ELEMENT, BRANCH_H, BRANCH_ROMAN, CHECKS, FEEDS, STEM_ELEMENT, STEM_H, STEM_ROMAN,
  chartOf, signOf, type BirthInput, type Element, type Pillar,
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

export interface LuckCycle { startAge: number; endAge: number; startYear: number; pillar: PillarDetail }
export interface FullChart {
  sign: ReturnType<typeof signOf>;
  pillars: { year: PillarDetail; month: PillarDetail; day: PillarDetail; hour: PillarDetail | null };
  elements: Record<Element, number>;
  luck: { forward: boolean; startAge: number; cycles: LuckCycle[] };
  years: { year: number; pillar: PillarDetail }[];
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

export function fullChart(b: BirthInput, gender: Gender, years: number[]): FullChart {
  const c = chartOf(b);
  const ds = c.day.stem;
  const pillars = { year: detail(c.year, ds), month: detail(c.month, ds), day: detail(c.day, ds, true), hour: c.hour ? detail(c.hour, ds) : null };
  const elements: Record<Element, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  for (const p of [c.year, c.month, c.day, c.hour]) {
    if (!p) continue;
    elements[STEM_ELEMENT[p.stem]]++; elements[BRANCH_ELEMENT[p.branch]]++;
  }
  return {
    sign: signOf(b), pillars, elements,
    luck: luckCycles(b, gender, c.year, c.month, c.instant, c.sunLongitude, ds),
    years: years.map((y) => ({ year: y, pillar: detail(yearPillarOf(y), ds) })),
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
    `Yearly pillars:`,
    ...ch.years.map((y) => `- ${y.year} (age ${age(y.year)}): ${y.pillar.han} (${y.pillar.stem.element} ${TEN_GOD[y.pillar.stem.tenGod as TenGod]} / ${y.pillar.branch.animal} ${y.pillar.branch.element} ${TEN_GOD[y.pillar.branch.tenGod]})`),
  ].join("\n");
}
