// 공통 HTTP 도우미: 에러 → 응답 변환, 요청 본문 읽기

export class HttpError extends Error {
  constructor(public status: number, public code: string, public body?: unknown) {
    super(code);
  }
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "BAD_JSON");
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** 라우트 핸들러를 감싸 HttpError는 그 상태로, 나머지는 500으로 돌려준다. */
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await fn(req);
    } catch (e) {
      // Next.js 내부 신호(빌드 때 "이 경로는 요청마다 실행" 표시 등)는 그대로 넘긴다
      if (e && typeof e === "object" && "digest" in e) throw e;
      if (e instanceof HttpError) return json(e.body ?? { success: false, error: e.code }, e.status);
      console.error("[api] unexpected", e);
      return json({ success: false, error: "INTERNAL" }, 500);
    }
  };
}

export const str = (v: unknown, max = 500): string => (typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : String(v).slice(0, max));
export const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
