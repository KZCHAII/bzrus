// 리포트 카드: 완성된 리포트 글을 AI에게 주고 "글에 있는 내용만" 섹션별 카드로 뽑는다 (BZR 섹션별 카드 방식, 영어판).
// 화면은 원래 글의 모든 섹션을 순서대로 보여 주고, 카드가 있는 섹션엔 카드를 얹는다 → 글이 빠질 일 없음.
import { services } from "./services";

export const MODEL = "gemini-3.1-pro-preview";

export interface Pair { title: string; desc: string }
export interface Section {
  heading: string;
  kind: "points" | "timeline" | "qa";
  summary: string;
  points: Pair[];
  timeline: { label: string; tone: "up" | "down" | "mix"; title: string; desc: string; score: number }[];
  qa: { q: string; a: string }[];
  highlight: string;
}
export const AREAS = ["Work", "Money", "Love", "Health", "Growth"] as const;
export interface Cards {
  layout: "generic";
  /** 지금 대운이 각 영역에 미치는 영향 (글의 "Current 10-Year Cycle" 섹션에서) */
  cycle?: { theme: string; areas: { area: (typeof AREAS)[number]; score: number; note: string }[] };
  /** 나에게 맞는 사람 (글의 "Who Fits You" 섹션에서) */
  fit?: { summary: string; traits: Pair[]; avoid: string };
  core: { headline: string; body: string; strength: Pair; caution: Pair };
  sections: Section[];
  final: { conclusion: string; last_line: string };
}

const S = { type: "STRING" };
const PAIR = { type: "OBJECT", properties: { title: S, desc: S }, required: ["title", "desc"] };
export const CARDS_SCHEMA = {
  type: "OBJECT",
  properties: {
    core: { type: "OBJECT", properties: { headline: S, body: S, strength: PAIR, caution: PAIR }, required: ["headline", "body", "strength", "caution"] },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          heading: S, kind: { type: "STRING", enum: ["points", "timeline", "qa"] }, summary: S,
          points: { type: "ARRAY", items: PAIR },
          timeline: { type: "ARRAY", items: { type: "OBJECT", properties: { label: S, tone: { type: "STRING", enum: ["up", "down", "mix"] }, title: S, desc: S, score: { type: "INTEGER" } }, required: ["label", "tone", "title", "desc", "score"] } },
          qa: { type: "ARRAY", items: { type: "OBJECT", properties: { q: S, a: S }, required: ["q", "a"] } },
          highlight: S,
        },
        required: ["heading", "kind", "summary", "points", "timeline", "qa", "highlight"],
      },
    },
    final: { type: "OBJECT", properties: { conclusion: S, last_line: S }, required: ["conclusion", "last_line"] },
    cycle: { type: "OBJECT", properties: { theme: S, areas: { type: "ARRAY", items: { type: "OBJECT", properties: { area: { type: "STRING", enum: [...AREAS] }, score: { type: "INTEGER" }, note: S }, required: ["area", "score", "note"] } } }, required: ["theme", "areas"] },
    fit: { type: "OBJECT", properties: { summary: S, traits: { type: "ARRAY", items: PAIR }, avoid: S }, required: ["summary", "traits", "avoid"] },
  },
  required: ["core", "sections", "final", "cycle", "fit"],
};

/** 리포트 글의 ## 제목들 (순서대로) */
export function headingsOf(report: string): string[] {
  return report.replace(/\r/g, "").split("\n").map((l) => l.trim().match(/^#{1,3}\s*(.+)$/)?.[1]?.trim() ?? "").filter(Boolean);
}

export function cardsPrompt(report: string): string {
  const heads = headingsOf(report);
  return `Below is the full text of one person's Korean Saju reading. The text will be shown to the reader exactly as written.
Your job is to build "summary cards" that sit on top of it, so the reader sees the key points at a glance before the long text.

Rules
- Use only what is in this text. Do not add facts, events, jobs, years, numbers or advice that are not there. A summary must not change the meaning of the original.
- Short and plain. Replace jargon in the original (architecture, operating system, leverage, interface, system) with plain words that mean the same.
- Prefer specifics that only this text contains over generic labels ("responsible", "leadership", "empathy").
- Titles (title) under 6 words. Descriptions (desc) one sentence under 20 words.

core: the conclusion of the whole reading. Take it from "Core Diagnosis" and "Final Recommendation".
- headline: one sentence, under 15 words. body: two sentences on why, under 40 words. strength / caution: the single biggest strength (opportunity) and the single thing to watch most, as the text says.

sections: one per section in the "Section headings" list, in the same order. Put the heading exactly as listed.
- Skip the very first section (the report title with only a greeting) and the very last section that is only one sentence.
- Pick kind by the shape of the section:
  - "timeline": the section is split by period (years, months, stretches). One timeline entry per period: label (for example "2027", "Mar-May 2027"), tone (good period up, careful period down, mixed or turning point mix), title (the core of the period, short), desc (one sentence), score (size of the opportunity in that period, 1-5). Include every period the text covers and none it does not.
  - "qa": the section answers questions. qa: the question in one line and the answer (conclusion first, 2-3 sentences).
  - "points": every other section. points: the 2-4 key points (title + desc).
  - Use [] for arrays that do not apply.
- summary: the section in 1-2 sentences, under 35 words.
- highlight: the single sharpest sentence in the section body that would make a reader stop, copied character for character. "" if none fits.

cycle: from the "Your Current 10-Year Cycle" section. theme: the energy that dominates now, under 8 words. areas: exactly five entries, Work, Money, Love, Health, Growth, each with score (how favorable this cycle is for that area, 1-5, as the text implies) and note (one sentence under 15 words). If the section is missing, theme "" and areas [].

fit: from the "Who Fits You" section. summary: one sentence on who fits this person. traits: 2-3 personality traits of people who fit (title + desc). avoid: one sentence on the type that drains this person. If the section is missing, all empty.

final: conclusion is the closing recommendation in one or two sentences; last_line is the very last sentence of the text, copied exactly (if the text ends with a heading in parentheses, that sentence).

Section headings
${heads.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Full text
---
${report}
---`;
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pair = (v: unknown): Pair => ({ title: s((v as Pair)?.title, 80), desc: s((v as Pair)?.desc, 240) });
const arr = <T>(v: unknown, max: number, map: (x: Record<string, unknown>) => T): T[] =>
  (Array.isArray(v) ? v : []).slice(0, max).map((x) => map((x ?? {}) as Record<string, unknown>));
const clampInt = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function parseCards(raw: string, report: string): Cards {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  const j = JSON.parse(text) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const flat = report.replace(/\s+/g, " ");
  const heads = new Set(headingsOf(report));
  const tone = (v: unknown) => (["up", "down", "mix"].includes(String(v)) ? v : "mix") as "up" | "down" | "mix";
  const c: Cards = {
    layout: "generic",
    core: { headline: s(j.core?.headline, 160), body: s(j.core?.body, 400), strength: pair(j.core?.strength), caution: pair(j.core?.caution) },
    sections: arr(j.sections, 25, (x) => ({
      heading: s(x.heading, 160),
      kind: (["points", "timeline", "qa"].includes(String(x.kind)) ? x.kind : "points") as Section["kind"],
      summary: s(x.summary, 400),
      points: arr(x.points, 4, (p) => pair(p)).filter((p) => p.title || p.desc),
      timeline: arr(x.timeline, 14, (t) => ({ label: s(t.label, 30), tone: tone(t.tone), title: s(t.title, 80), desc: s(t.desc, 240), score: clampInt(t.score, 1, 5, 3) })),
      qa: arr(x.qa, 5, (q) => ({ q: s(q.q, 240), a: s(q.a, 700) })),
      // 강조 문장은 본문에 실제로 있는 문장만 (지어낸 문장 차단)
      highlight: (() => { const h = s(x.highlight, 400); return h && flat.includes(h.replace(/\s+/g, " ")) ? h : ""; })(),
    })).filter((x) => heads.has(x.heading)),
    final: { conclusion: s(j.final?.conclusion, 400), last_line: s(j.final?.last_line, 300) },
    cycle: {
      theme: s(j.cycle?.theme, 80),
      areas: AREAS.map((a) => { const x = (Array.isArray(j.cycle?.areas) ? j.cycle.areas : []).find((y: Record<string, unknown>) => y?.area === a); return x ? { area: a, score: clampInt(x.score, 1, 5, 3), note: s(x.note, 160) } : null; })
        .filter((x): x is { area: (typeof AREAS)[number]; score: number; note: string } => !!x),
    },
    fit: { summary: s(j.fit?.summary, 300), traits: arr(j.fit?.traits, 3, (p) => pair(p)).filter((p) => p.title), avoid: s(j.fit?.avoid, 300) },
  };
  if (!c.core.headline || c.sections.length === 0) throw new Error("CARDS_INCOMPLETE");
  return c;
}

export async function extractCards(report: string): Promise<Cards> {
  return parseCards(await services().ai.generate(MODEL, cardsPrompt(report), { schema: CARDS_SCHEMA }), report);
}
