export function req(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; ip?: string } = {}) {
  return new Request(`http://localhost${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json", "x-forwarded-for": init.ip ?? "203.0.113.7", ...(init.headers ?? {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
export async function call(h: (r: Request) => Promise<Response>, r: Request) {
  const res = await h(r);
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
