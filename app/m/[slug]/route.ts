import { viewMap } from "@/lib/maps";

// 마이페이지 HTML에 링크 미리보기 정보(제목·설명·이미지)를 넣어서 돌려준다. 화면 자체는 public/map.html 그대로.
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const origin = new URL(req.url).origin;
  const htmlRes = await fetch(`${origin}/map.html`, { cache: "no-store" });
  let html = await htmlRes.text();
  try {
    const m = await viewMap(slug, "");
    const s = m.sign as { title?: string; name: string; tagline: string };
    const title = `${m.name} is the ${s.title ?? s.name}. What's yours?`;
    const desc = `${s.tagline} Add your birthday to see your Korean sign and your match with ${m.name}.`;
    const img = `${origin}/api/og?slug=${encodeURIComponent(m.slug)}`;
    const meta = [
      `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(desc)}">`,
      `<meta property="og:image" content="${esc(img)}">`, `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`,
      `<meta property="og:url" content="${esc(`${origin}/m/${m.slug}`)}">`, `<meta property="og:type" content="website">`,
      `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:title" content="${esc(title)}">`, `<meta name="twitter:image" content="${esc(img)}">`,
    ].join("\n");
    html = html
      .replace(/<meta property="og:title"[^>]*>\n?/, "").replace(/<meta property="og:description"[^>]*>\n?/, "")
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} — WITHSAJU</title>`)
      .replace("</head>", `${meta}\n</head>`);
  } catch { /* 없는 지도: 화면이 알아서 404 안내 */ }
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache, no-store, must-revalidate" } });
}
