// 사주 엔진 점검: 공개 만세력 라이브러리와 대조 + 타입·관계 규칙
import { describe, expect, it } from "vitest";
import * as manseryeok from "@fullstackfamily/manseryeok";
import { chartOf, dayPillar, pillarKo, relationOf, signOf, validBirth, zodiacOf } from "@/lib/saju";

const calc = (manseryeok as unknown as { calculateSaju: (y: number, m: number, d: number, h: number, mi: number, o: object) => Record<string, string> }).calculateSaju;
const mod = (n: number, k: number) => ((n % k) + k) % k;

describe("만세력 대조 (1940–2044, 약 2만 8천 시점)", () => {
  const rows: { s: string; lib: Record<string, string>; c: ReturnType<typeof chartOf> }[] = [];
  for (let t = Date.UTC(1940, 0, 1); t < Date.UTC(2045, 0, 1); t += 86400000 * 1.37) {
    const dt = new Date(t);
    const y = dt.getUTCFullYear(), mo = dt.getUTCMonth() + 1, d = dt.getUTCDate();
    if (mo === 12 && d === 31) continue; // 라이브러리 버그: 일부 해의 12월 31일 년주를 엉뚱하게 냄 (예: 1949-12-31 → 을사)
    const h = mod(Math.floor(t / 3600000), 24), mi = (y * 7) % 60;
    rows.push({ s: `${y}-${mo}-${d} ${h}:${mi}`, lib: calc(y, mo, d, h, mi, { applyTimeCorrection: false }), c: chartOf({ year: y, month: mo, day: d, hour: h, minute: mi, utcOffsetMinutes: 540 }) });
  }

  it("일주·시주는 전부 같다", () => {
    expect(rows.filter((r) => r.lib.dayPillar !== pillarKo(r.c.day)).map((r) => r.s)).toEqual([]);
    expect(rows.filter((r) => r.lib.hourPillar !== pillarKo(r.c.hour!)).map((r) => r.s)).toEqual([]);
  });

  it("년주·월주가 다른 건 절기 당일뿐 (라이브러리는 날짜 단위, 우리는 절입 시각까지 계산)", () => {
    const diff = rows.filter((r) => r.lib.yearPillar !== pillarKo(r.c.year) || r.lib.monthPillar !== pillarKo(r.c.month));
    expect(diff.length / rows.length).toBeLessThan(0.02);
    for (const r of diff) {
      // 절기(황경 15°+30°k) 경계에서 1.5° (하루 반) 안쪽이어야 한다
      const toBoundary = Math.abs(mod(r.c.sunLongitude, 30) - 15);
      expect(toBoundary, r.s).toBeLessThan(1.5);
    }
  });
});

describe("Korean sign", () => {
  it("예시: 1996-11-21 → 壬, Winter Ocean, Scorpio", () => {
    const s = signOf({ year: 1996, month: 11, day: 21 });
    expect(s).toMatchObject({ name: "Winter Ocean", hanja: "壬", element: "Water", yang: true, strength: "peak", zodiac: "Scorpio" });
    expect(s.dayPillar.han).toBe("壬戌");
  });
  it("2000-01-01 일주는 戊午", () => {
    expect(pillarKo(dayPillar(2000, 1, 1))).toBe("무오");
  });
  it("별자리 경계", () => {
    expect(zodiacOf(0.1)).toBe("Aries");
    expect(zodiacOf(359.9)).toBe("Pisces");
    expect(signOf({ year: 1990, month: 7, day: 4 }).zodiac).toBe("Cancer");
  });
  it("40가지 타입이 다 나온다", () => {
    const seen = new Set<string>();
    for (let t = Date.UTC(1990, 0, 1); t < Date.UTC(1993, 0, 1); t += 86400000) {
      const d = new Date(t);
      seen.add(signOf({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }).key);
    }
    expect(seen.size).toBe(40);
  });
  it("잘못된 날짜는 거절", () => {
    expect(validBirth({ year: 2023, month: 2, day: 29 })).toBe(false);
    expect(validBirth({ year: 1899, month: 1, day: 1 })).toBe(false);
    expect(() => signOf({ year: 2023, month: 13, day: 1 })).toThrow("INVALID_BIRTH");
  });
});

describe("관계", () => {
  const water = signOf({ year: 1996, month: 11, day: 21 }); // 壬 Water
  it("오행 생극대로", () => {
    const find = (el: string) => {
      for (let t = Date.UTC(1990, 0, 1); ; t += 86400000) {
        const d = new Date(t), s = signOf({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
        if (s.element === el) return s;
      }
    };
    expect(relationOf(water, find("Water")).kind).toBe("mirror");
    expect(relationOf(water, find("Metal")).kind).toBe("battery"); // 금생수
    expect(relationOf(water, find("Wood")).kind).toBe("spark");    // 수생목
    expect(relationOf(water, find("Fire")).kind).toBe("copilot");  // 수극화
    expect(relationOf(water, find("Earth")).kind).toBe("coach");   // 토극수
  });
  it("점수는 1–99", () => {
    const b = signOf({ year: 1995, month: 4, day: 2 });
    const r = relationOf(water, b);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(100);
  });
});

describe("상세 원국 (십신·대운)", async () => {
  const { fullChart, tenGodOf, yearPillarOf, chartText } = await import("@/lib/saju-chart");
  it("십신: 庚 일간 기준", () => {
    // 庚(6) 기준: 庚 비견, 辛 겁재, 壬 식신, 癸 상관, 甲 편재, 乙 정재, 丙 편관, 丁 정관, 戊 편인, 己 정인
    expect([6, 7, 8, 9, 0, 1, 2, 3, 4, 5].map((s) => tenGodOf(6, s))).toEqual(
      ["companion", "rob", "eating", "hurting", "indirectWealth", "directWealth", "sevenKillings", "directOfficer", "indirectResource", "directResource"]);
  });
  it("세운: 2026 丙午, 1984 甲子", () => {
    expect(yearPillarOf(2026)).toEqual({ stem: 2, branch: 6 });
    expect(yearPillarOf(1984)).toEqual({ stem: 0, branch: 0 });
  });
  it("대운: 1992-03-15 14:30 (壬申년 = 양년), 남자 순행 / 여자 역행", () => {
    const b = { year: 1992, month: 3, day: 15, hour: 14, minute: 30, utcOffsetMinutes: 540 };
    const m = fullChart(b, "man", [2026]), w = fullChart(b, "woman", [2026]);
    expect(m.luck.forward).toBe(true);
    expect(w.luck.forward).toBe(false);
    // 월주 癸卯 → 순행 첫 대운 甲辰, 역행 첫 대운 壬寅
    expect(m.luck.cycles[0].pillar.han).toBe("甲辰");
    expect(w.luck.cycles[0].pillar.han).toBe("壬寅");
    // 경칩(3/5)에서 10일 지남 → 역행 약 3세, 다음 절기 청명(4/4)까지 약 20일 → 순행 약 7세
    expect(w.luck.startAge).toBe(3);
    expect(m.luck.startAge).toBe(7);
    expect(m.elements).toEqual({ Wood: 2, Fire: 0, Earth: 1, Metal: 2, Water: 3 });
  });
  it("시간 모름이면 시주 없음, 글에도 그렇게", () => {
    const ch = fullChart({ year: 1992, month: 3, day: 15 }, "woman", [2026]);
    expect(ch.pillars.hour).toBeNull();
    const t = chartText(ch, "Alex", { iso: "1992-03-15", time: null }, "woman", 2026);
    expect(t).toContain("unknown (birth time not given)");
    expect(t).toContain("CURRENT CYCLE");
  });
});

describe("계절별 타입·스피릿 애니멀", () => {
  it("같은 Sun이라도 여름과 겨울은 다른 설명", () => {
    let summer = "", winter = "";
    for (let t = Date.UTC(1990, 0, 1); (!summer || !winter); t += 86400000) {
      const d = new Date(t), s = signOf({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
      if (s.name === "Summer Sun") summer = s.tagline;
      if (s.name === "Winter Sun") winter = s.tagline;
    }
    expect(summer).toMatch(/Intense/);
    expect(winter).toMatch(/loved/);
  });
  it("1996-11-21 壬戌 → Black Dog", () => {
    expect(signOf({ year: 1996, month: 11, day: 21 }).animal).toMatchObject({ name: "Dog", color: "Black" });
    expect(signOf({ year: 1996, month: 11, day: 21 }).title).toBe("Black Dog of the Winter Ocean");
  });
});

describe("합·충·형·파·해", async () => {
  const { branchLinks, stemLinks, relationOf, signOf: so } = await import("@/lib/saju");
  it("일지 관계", () => {
    expect(branchLinks(10, 3)).toEqual(["sixHarmony"]);          // 戌卯 육합
    expect(branchLinks(10, 2)).toEqual(["trine"]);                // 戌寅 삼합
    expect(branchLinks(10, 4)).toEqual(["clash"]);                // 戌辰 충
    expect(branchLinks(10, 7)).toEqual(expect.arrayContaining(["punish", "break"])); // 戌未 형·파
    expect(branchLinks(9, 10)).toEqual(["harm"]);                 // 酉戌 해
    expect(branchLinks(2, 11)).toEqual(["sixHarmony"]);           // 寅亥: 합이면 파는 무시
  });
  it("일간 합·충", () => {
    expect(stemLinks(0, 5)).toEqual(["stemHarmony"]);  // 甲己
    expect(stemLinks(2, 8)).toEqual(["stemClash"]);    // 丙壬
    expect(stemLinks(4, 0)).toEqual([]);
  });
  it("점수에 반영되고 30~99", () => {
    const a = so({ year: 1996, month: 11, day: 21 });
    for (let t = Date.UTC(1990, 0, 1); t < Date.UTC(1990, 3, 1); t += 86400000) {
      const d = new Date(t), r = relationOf(a, so({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }));
      expect(r.score).toBeGreaterThanOrEqual(30); expect(r.score).toBeLessThanOrEqual(99);
    }
  });
});

describe("추천 띠·개운법", async () => {
  const { fullChart } = await import("@/lib/saju-chart");
  it("1996-11-21(戌): 卯 육합 먼저, 辰 충은 조심, 부족한 오행 개운법", () => {
    const ch = fullChart({ year: 1996, month: 11, day: 21 }, "man", [2026], 2026);
    expect(ch.match.animals.best[0]).toMatchObject({ animal: "Rabbit", link: "sixHarmony" });
    expect(ch.match.animals.avoid.map((a) => a.animal)).toContain("Dragon");
    expect(ch.match.boosters.length).toBeGreaterThan(0);
    // 추천 일주는 실제로 있는 조합 (음양 일치)
    for (const p of ch.match.animals.picks) expect(p.han).toMatch(/^[甲丙戊庚壬][子寅辰午申戌]$|^[乙丁己辛癸][丑卯巳未酉亥]$/);
  });
});

describe("지장간 잠재력", () => {
  it("본래 오행은 빼고 숨은 기운만 일수/30으로 센다", async () => {
    const { hiddenOf } = await import("../lib/saju");
    // 子·卯·酉는 겉과 속이 같아 잠재력 0
    expect(Object.values(hiddenOf([0, 3, 9]).hidden).every((v) => v === 0)).toBe(true);
    // 戌: 辛 9일(Metal 0.3) 丁 3일(Fire 0.1)
    const d = hiddenOf([10]);
    expect(d.hidden.Metal).toBe(0.3);
    expect(d.hidden.Fire).toBe(0.1);
    expect(d.hidden.Earth).toBe(0);
    // 寅: 戊 0.2(7/30) 丙 0.2
    expect(hiddenOf([2]).hidden).toMatchObject({ Earth: 0.2, Fire: 0.2, Wood: 0 });
  });
});

describe("궁합 점수 분포", () => {
  it("70~80점대에 몰리지 않고 넓게 퍼진다", () => {
    let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const rb = () => { const d = new Date(Date.UTC(1965, 0, 1) + rnd() * 40 * 365.25 * 864e5); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }; };
    const xs: number[] = [];
    for (let i = 0; i < 2000; i++) xs.push(relationOf(signOf(rb()), signOf(rb())).score);
    xs.sort((a, b) => a - b);
    const q = (p: number) => xs[Math.floor(p * (xs.length - 1))];
    expect(new Set(xs).size).toBeGreaterThan(40);
    expect(q(0.1)).toBeLessThan(63);
    expect(q(0.9)).toBeGreaterThan(84);
    expect(xs.filter((x) => x === 99).length / xs.length).toBeLessThan(0.03);
  });
});
