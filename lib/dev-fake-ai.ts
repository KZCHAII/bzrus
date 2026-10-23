// 로컬 화면 확인용 가짜 AI (FAKE_AI=1, Vercel이 아닐 때만). 실제 배포에서는 절대 쓰지 않는다.
import type { Ai } from "./services";

const para = (s: string) => Array.from({ length: 3 }, (_, i) => `${s} This is sample paragraph ${i + 1} for checking the layout on a phone screen. ${"The real reading is written from your exact chart. ".repeat(4)}`).join("\n\n");
export const SAMPLE = `##Strategic Destiny Report
This report is a data asset built by parsing your Four Pillars, calculated from the exact moment of birth.

##Your Core Design: Temperament and Wiring
${para("As a Yang Metal Day Master born in spring, you decide fast and cut through what others circle around.")}

##Your Current 10-Year Cycle: Ages 33-42
${para("Right now pressure and ambition run your life.")}

##Looking Back: 2021-2025
2021 was a year of change. ${para("In 2023 you rebuilt your routine.")}

##The Next Five Years: 2026-2030
${para("2027 opens a door in work; 2029 asks you to slow down.")}

##Money: How You Earn and How You Lose
${para("You earn by moving first.")}

##People: Your Relationship Patterns
${para("You protect a small circle.")}

##Who Fits You
${para("People with steady water calm you down.")}

##Body and Mind
${para("Your energy runs hot, then crashes.")}

##Boost Your Luck
${para("Swim more, and plan a winter trip north.")}

##Core Diagnosis: The One Drive Behind Everything
Everything about you comes back to the need to prove your own judgment. ${para("That drive makes you fast.")}

##Final Recommendation
Keep the speed, add one pause before the big calls.

##(You don't have to win every room to be right.)`;

export const fakeAi: Ai = {
  async generate(_model, prompt, opts) {
    await new Promise((r) => setTimeout(r, 4000));
    if (!opts?.schema) return SAMPLE;
    const heads = SAMPLE.split("\n").filter((l) => l.startsWith("##")).map((l) => l.slice(2).trim()).slice(1, -1);
    return JSON.stringify({
      core: { headline: "Your edge is speed; your task is one pause.", body: "You move before others decide. The same speed costs you when the stakes are high.", strength: { title: "First mover", desc: "You act while others are still thinking." }, caution: { title: "Hot then crash", desc: "Your energy spikes and drops; plan the rest." } },
      sections: heads.map((h) => h.startsWith("Looking Back") || h.startsWith("The Next")
        ? { heading: h, kind: "timeline", summary: "Year by year.", points: [], timeline: [{ label: "2027", tone: "up", title: "A door in work", desc: "A role or project opens.", score: 4 }, { label: "2029", tone: "down", title: "Slow down", desc: "Rest before the next push.", score: 2 }], qa: [], highlight: "" }
        : { heading: h, kind: "points", summary: "The short version of this section.", points: [{ title: "Point one", desc: "A specific thing from the text." }, { title: "Point two", desc: "Another specific thing." }], timeline: [], qa: [], highlight: "" }),
      cycle: { theme: "Pressure that builds your name", areas: [{ area: "Work", score: 5, note: "Your biggest push in a decade." }, { area: "Money", score: 3, note: "More comes in, more goes out." }, { area: "Love", score: 2, note: "Work crowds out the people close to you." }, { area: "Health", score: 2, note: "Sleep is the first thing you cut." }, { area: "Growth", score: 4, note: "You learn to lead, not just do." }] },
      fit: { summary: "Calm, patient people who don't compete with you.", traits: [{ title: "Unhurried", desc: "They slow you down without stopping you." }, { title: "Honest", desc: "They tell you the plan has a hole." }], avoid: "People who match your speed and turn every day into a race." },
      final: { conclusion: "Keep the speed, add one pause before the big calls.", last_line: "You don't have to win every room to be right." },
    });
  },
};
