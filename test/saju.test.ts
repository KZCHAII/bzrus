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
