// 바깥 서비스 (AI). 테스트는 setServices로 가짜를 끼운다.
import { envOptional } from "./env";

export interface Ai {
  /** schema를 주면 그 모양의 JSON 문자열만 돌려받는다 (Gemini 구조화 출력) */
  generate(model: string, prompt: string, opts?: { schema?: object }): Promise<string>;
}

export const realAi: Ai = {
  async generate(model, prompt, opts) {
    const key = envOptional("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_KEY_MISSING");
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(opts?.schema ? { generationConfig: { responseMimeType: "application/json", responseSchema: opts.schema } } : {}),
      }),
    });
    const data = (await r.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
    if (!r.ok) throw new Error(`GEMINI_${r.status}:${(data.error?.message ?? "").slice(0, 200)}`);
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text.trim()) throw new Error("GEMINI_EMPTY");
    return text;
  },
};

export interface Services { ai: Ai }
const real: Services = { ai: realAi };
let current: Services | null = null;
export const services = (): Services => {
  if (current) return current;
  // 로컬 화면 확인용 가짜 AI: Vercel 밖에서 FAKE_AI=1일 때만
  if (process.env.FAKE_AI === "1" && !process.env.VERCEL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    current = { ...real, ai: (require("./dev-fake-ai") as typeof import("./dev-fake-ai")).fakeAi };
  } else current = real;
  return current;
};
export function setServices(over: Partial<Services> | null) { current = over ? { ...real, ...over } : real; }
