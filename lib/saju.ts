// 사주 계산 엔진 (서버·화면 공통 계산의 기준).
// - 일주: 율리우스 일수(JDN)로 계산 → 날짜만 있으면 정확
// - 년주·월주·계절: 태양 황경(절기)으로 계산 → 입춘·절입 경계를 시각까지 반영
// - 시주: 출생 시각(+ 선택: 출생지 경도로 진태양시 보정)
// 미국 손님용 "Korean sign" = 일간(10) × 태어난 계절(4) = 40가지 타입.
import { MakeTime, SunPosition } from "astronomy-engine";

export const STEM_H = "甲乙丙丁戊己庚辛壬癸";
export const BRANCH_H = "子丑寅卯辰巳午未申酉戌亥";
export const STEM_KO = "갑을병정무기경신임계";
export const BRANCH_KO = "자축인묘진사오미신유술해";
export const STEM_ROMAN = ["Gap", "Eul", "Byeong", "Jeong", "Mu", "Gi", "Gyeong", "Sin", "Im", "Gye"] as const;
export const BRANCH_ROMAN = ["ja", "chuk", "in", "myo", "jin", "sa", "o", "mi", "sin", "yu", "sul", "hae"] as const;

export type Element = "Wood" | "Fire" | "Earth" | "Metal" | "Water";
export type Season = "Spring" | "Summer" | "Autumn" | "Winter";

export const STEM_ELEMENT: Element[] = ["Wood", "Wood", "Fire", "Fire", "Earth", "Earth", "Metal", "Metal", "Water", "Water"];
export const BRANCH_ELEMENT: Element[] = ["Water", "Earth", "Wood", "Wood", "Earth", "Fire", "Fire", "Earth", "Metal", "Metal", "Earth", "Water"];
export const FEEDS: Record<Element, Element> = { Wood: "Fire", Fire: "Earth", Earth: "Metal", Metal: "Water", Water: "Wood" };
export const CHECKS: Record<Element, Element> = { Wood: "Earth", Fire: "Metal", Earth: "Water", Metal: "Wood", Water: "Fire" };
export const SEASON_ELEMENT: Record<Season, Element> = { Spring: "Wood", Summer: "Fire", Autumn: "Metal", Winter: "Water" };

export interface Pillar { stem: number; branch: number }
export const pillarHan = (p: Pillar) => STEM_H[p.stem] + BRANCH_H[p.branch];
export const pillarKo = (p: Pillar) => STEM_KO[p.stem] + BRANCH_KO[p.branch];

export interface BirthInput {
  year: number; month: number; day: number;
  /** 출생 시각 (모르면 비움 → 시주 없음, 경계 계산은 정오 기준) */
  hour?: number | null; minute?: number | null;
  /** 출생지 UTC 오프셋(분). 예: 뉴욕 겨울 -300. 없으면 -300(미국 동부)로 본다 */
  utcOffsetMinutes?: number;
  /** 출생지 경도(동경 +). 주면 시주를 진태양시로 보정 */
  longitude?: number | null;
}

export interface Chart {
  year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null;
  season: Season;
  /** 출생 순간의 태양 황경(도) */
  sunLongitude: number;
  /** 출생 순간 (UTC) */
  instant: Date;
}

export function julianDayNumber(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

/** 해당 날짜의 일주 (60갑자 index → 천간·지지) */
export function dayPillar(y: number, m: number, d: number): Pillar {
  const i = (julianDayNumber(y, m, d) + 49) % 60;
  return { stem: i % 10, branch: i % 12 };
}

export function sunLongitudeAt(date: Date): number {
  return SunPosition(MakeTime(date)).elon;
}

const mod = (n: number, k: number) => ((n % k) + k) % k;

export function validBirth(b: BirthInput): boolean {
  const { year, month, day } = b;
  if (![year, month, day].every(Number.isInteger)) return false;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return false;
  if (b.hour != null && (!Number.isInteger(b.hour) || b.hour < 0 || b.hour > 23)) return false;
  if (b.minute != null && (!Number.isInteger(b.minute) || b.minute < 0 || b.minute > 59)) return false;
  return true;
}

export function chartOf(b: BirthInput): Chart {
  if (!validBirth(b)) throw new Error("INVALID_BIRTH");
  const offset = b.utcOffsetMinutes ?? -300;
  const hasTime = b.hour != null;
  const h = hasTime ? b.hour! : 12, mi = hasTime ? b.minute ?? 0 : 0;
  const instant = new Date(Date.UTC(b.year, b.month - 1, b.day, h, mi) - offset * 60_000);
  const lon = sunLongitudeAt(instant);

  // 년주: 입춘(황경 315°) 전이면 전년도
  const beforeLichun = b.month <= 2 && lon >= 240 && lon < 315;
  const sajuYear = beforeLichun ? b.year - 1 : b.year;
  const year: Pillar = { stem: mod(sajuYear - 4, 10), branch: mod(sajuYear - 4, 12) };

  // 월주: 입춘부터 30°마다 한 달 (0 = 寅월)
  const k = Math.floor(mod(lon - 315, 360) / 30);
  const firstMonthStem = mod((year.stem % 5) * 2 + 2, 10);
  const month: Pillar = { stem: mod(firstMonthStem + k, 10), branch: mod(2 + k, 12) };

  // 일주: 달력 날짜 그대로 (23시대 출생도 날짜는 바뀌지 않음 — 생일만 넣은 결과와 같게)
  const day = dayPillar(b.year, b.month, b.day);
  let hour: Pillar | null = null;
  if (hasTime) {
    let minutes = h * 60 + mi;
    if (b.longitude != null) {
      // 진태양시 보정: 표준시 자오선과 출생지 경도 차이 × 4분
      minutes += Math.round((b.longitude - offset / 4) * 4);
    }
    minutes = mod(minutes, 1440);
    const branch = Math.floor(mod(minutes + 60, 1440) / 120) % 12;
    hour = { stem: mod((day.stem % 5) * 2 + branch, 10), branch };
  }

  const mb = month.branch;
  const season: Season = mb >= 2 && mb <= 4 ? "Spring" : mb >= 5 && mb <= 7 ? "Summer" : mb >= 8 && mb <= 10 ? "Autumn" : "Winter";
  return { year, month, day, hour, season, sunLongitude: lon, instant };
}

// ── 서양 별자리 ──
export const ZODIAC = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"] as const;
export const zodiacOf = (sunLongitude: number) => ZODIAC[Math.floor(mod(sunLongitude, 360) / 30)];

// ── Korean sign (40 types) ──
export const STEM_TYPE = [
  { name: "Great Tree", tagline: "Pick a direction once, then grow straight up." },
  { name: "Wild Vine", tagline: "Soft on the outside. Finds a way around anything." },
  { name: "Sun", tagline: "Walks in and the room warms up. Can't hide even if you try." },
  { name: "Candle", tagline: "A small flame with deep focus. You light one person at a time." },
  { name: "Mountain", tagline: "Steady and hard to move. Everyone leans on you." },
  { name: "Garden", tagline: "You grow people. Most of them never notice it was you." },
  { name: "Blade", tagline: "Decisive. You cut straight through what others circle around." },
  { name: "Jewel", tagline: "Sharp taste and high standards. Pressure makes you shine." },
  { name: "Ocean", tagline: "Big, restless, holds everything. Calm on top, deep underneath." },
  { name: "Rain", tagline: "Quiet and patient. You change things slowly, then completely." },
] as const;

/** 일간 × 계절: 같은 Sun이라도 여름 해는 강렬하고 겨울 해는 반갑다 */
export const SEASON_LINE: Record<number, Record<Season, string>> = {
  0: { Spring: "A tree in its own season. You grow fast, everyone sees it, and you are hard to stop.", Summer: "A tree in full summer. Generous shade for everyone, but you burn through your own water.", Autumn: "A tree pruned by cold wind. Tested early, disciplined, stronger for every cut.", Winter: "A tree in winter. Still on the surface, quietly storing strength for your moment." },
  1: { Spring: "A flower in spring. Charming, everywhere at once, impossible to ignore.", Summer: "A vine in summer sun. Bright and social, but you wilt without real rest.", Autumn: "A vine in autumn. You survive what breaks bigger plants; bending is your strength.", Winter: "A winter vine. Delicate on the outside, stubborn about staying alive." },
  2: { Spring: "A spring sun. Gentle warmth that makes everything around you grow.", Summer: "A summer sun. Intense and blazing; people can't look away, and sometimes it's too much.", Autumn: "An autumn sun. Golden, mature light: warm, but clear-eyed.", Winter: "A winter sun. The warmth everyone waits for. Rare, welcome, and deeply loved." },
  3: { Spring: "A candle in spring. A soft, steady light with a romantic streak.", Summer: "A candle among summer suns. You shine by being precise, not loud.", Autumn: "A candle in autumn. The light people gather around as the nights get longer.", Winter: "A candle in winter. A small flame that means everything in the dark. People need you." },
  4: { Spring: "A mountain in spring. Solid ground where everything new takes root.", Summer: "A mountain in summer. Hot, dry and imposing; your strength needs softening.", Autumn: "A mountain at harvest. Reliable, unhurried, rich in reserves.", Winter: "A snow-capped mountain. Quiet, hard to read, impossible to move." },
  5: { Spring: "A garden in spring. Whatever you plant comes up; a natural nurturer.", Summer: "A garden in summer. Rich soil; you make other people's ideas grow.", Autumn: "A garden at harvest. Practical and generous; you see the results of your care.", Winter: "A garden at rest. Patient and private, preparing for the next season." },
  6: { Spring: "A blade in spring. Sharp in a soft season; you cut paths others can't see.", Summer: "A blade forged in summer fire. Pressure made you tough, tempered and intense.", Autumn: "Steel in its own season. Decisive, uncompromising, at full strength.", Winter: "A blade in winter. Cold and clear: a brilliant mind behind a guarded heart." },
  7: { Spring: "A jewel in spring. Polished and charming; you shine in fresh company.", Summer: "A jewel under summer heat. Pressure shapes you; you sparkle after hard times.", Autumn: "A jewel in autumn. Refined and exact, with rare taste and high standards.", Winter: "A jewel washed in winter water. Elegant, sharp, a little out of reach." },
  8: { Spring: "A spring ocean. Currents that feed everything; generous, restless, full of ideas.", Summer: "A summer ocean. Warm water and big moods; people are drawn to your depth.", Autumn: "An autumn ocean with rising tides. Powerful, strategic, gaining strength.", Winter: "A winter ocean. Vast and calm on top, holding more than anyone knows." },
  9: { Spring: "Spring rain. Things grow where you go; gentle, nourishing, quietly essential.", Summer: "Summer rain. Relief on a hot day; people feel better when you arrive.", Autumn: "Autumn rain. Reflective and perceptive; you notice what others miss.", Winter: "Winter rain. Still water and deep intuition; a mystery even to close friends." },
};

/** 일지 동물 + 일간 오방색 (목=Blue, 화=Red, 토=Yellow, 금=White, 수=Black) */
export const ANIMAL = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"] as const;
export const ELEMENT_COLOR: Record<Element, string> = { Wood: "Blue", Fire: "Red", Earth: "Yellow", Metal: "White", Water: "Black" };
export const ANIMAL_LINE: Record<string, string> = {
  Rat: "quick, resourceful, always a step ahead", Ox: "patient, strong, finishes what it starts", Tiger: "brave, restless, born to lead",
  Rabbit: "gentle, sharp-eared, wins by avoiding fights", Dragon: "big energy, big plans, hard to ignore", Snake: "quiet, deep, reads people instantly",
  Horse: "free, fast, needs open road", Goat: "kind, creative, wants a peaceful home", Monkey: "clever, playful, solves anything",
  Rooster: "proud, precise, says what it sees", Dog: "loyal, honest, guards its people", Pig: "warm, generous, enjoys life fully",
};

export type Strength = "peak" | "fed" | "off";

export interface KoreanSign {
  key: string;            // "winter-ocean"
  name: string;           // "Winter Ocean"
  hanja: string;          // "壬"
  tagline: string;
  element: Element;
  yang: boolean;
  season: Season;
  strength: Strength;     // 득령: 제철(peak) / 계절이 생해 줌(fed) / 그 밖(off)
  dayPillar: { han: string; roman: string };
  zodiac: (typeof ZODIAC)[number];
  sunLongitude: number;
  stem: number;
  /** 일지 동물 + 일간 색 (네온 그림) */
  animal: { name: string; color: string; line: string };
  /** 네 기둥 (시간을 모르면 hour = null) */
  pillars: { year: PillarView; month: PillarView; day: PillarView; hour: PillarView | null };
}

export interface PillarView { han: string; roman: string; stemElement: Element; branchElement: Element }
const pillarView = (p: Pillar): PillarView => ({
  han: pillarHan(p), roman: `${STEM_ROMAN[p.stem]}-${BRANCH_ROMAN[p.branch]}`,
  stemElement: STEM_ELEMENT[p.stem], branchElement: BRANCH_ELEMENT[p.branch],
});

export function signOf(b: BirthInput): KoreanSign {
  const c = chartOf(b);
  const stem = c.day.stem;
  const element = STEM_ELEMENT[stem];
  const sEl = SEASON_ELEMENT[c.season];
  const strength: Strength = sEl === element ? "peak" : FEEDS[sEl] === element ? "fed" : "off";
  const t = STEM_TYPE[stem];
  return {
    key: `${c.season}-${t.name}`.toLowerCase().replace(/\s+/g, "-"),
    name: `${c.season} ${t.name}`,
    hanja: STEM_H[stem],
    tagline: SEASON_LINE[stem]?.[c.season] ?? t.tagline,
    element, yang: stem % 2 === 0, season: c.season, strength,
    animal: { name: ANIMAL[c.day.branch], color: ELEMENT_COLOR[element], line: ANIMAL_LINE[ANIMAL[c.day.branch]] },
    dayPillar: { han: pillarHan(c.day), roman: `${STEM_ROMAN[stem]}-${BRANCH_ROMAN[c.day.branch]}` },
    zodiac: zodiacOf(c.sunLongitude),
    sunLongitude: Math.round(c.sunLongitude * 10) / 10,
    stem,
    pillars: { year: pillarView(c.year), month: pillarView(c.month), day: pillarView(c.day), hour: c.hour ? pillarView(c.hour) : null },
  };
}

// ── 두 사람 관계 (오행 생극) ──
export type RelationKind = "mirror" | "battery" | "spark" | "copilot" | "coach";
export const RELATIONS: Record<RelationKind, { name: string; base: number }> = {
  mirror: { name: "Mirror", base: 74 },     // 비겁: 같은 오행
  battery: { name: "Battery", base: 88 },   // 인성: 상대가 나를 생함
  spark: { name: "Spark", base: 82 },       // 식상: 내가 상대를 생함
  copilot: { name: "Co-pilot", base: 77 },  // 재성: 내가 상대를 극함
  coach: { name: "Coach", base: 69 },       // 관성: 상대가 나를 극함
};

/** owner 입장에서 본 friend의 관계. 점수는 같은 두 사람이면 항상 같다 */
export function relationOf(owner: KoreanSign, friend: KoreanSign): { kind: RelationKind; name: string; score: number } {
  const a = owner.element, b = friend.element;
  const kind: RelationKind = a === b ? "mirror" : FEEDS[b] === a ? "battery" : FEEDS[a] === b ? "spark" : CHECKS[a] === b ? "copilot" : "coach";
  const score = RELATIONS[kind].base + (owner.yang !== friend.yang ? 5 : 0) + (owner.season === friend.season ? 3 : 0) - ((owner.stem + friend.stem) % 4);
  return { kind, name: RELATIONS[kind].name, score: Math.min(99, score) };
}
