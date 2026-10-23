import { ImageResponse } from "next/og";
import { viewMap } from "@/lib/maps";
import { artSvg } from "@/lib/art";

// 링크 미리보기 이미지 (카톡·iMessage·X에 링크를 붙이면 뜨는 카드): "Alex is the Black Dog of the Winter Ocean. What's yours?"
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  let name = "", title = "What's your Korean sign?", tagline = "You know your zodiac sign. Meet your Korean one.", art = "";
  try {
    const m = await viewMap(slug, "");
    const s = m.sign as { title?: string; name: string; tagline: string; element: string; yang: boolean; season: string; hanja: string; animal?: { name: string } };
    name = m.name; title = s.title ?? s.name; tagline = s.tagline;
    if (s.animal) art = "data:image/svg+xml;utf8," + encodeURIComponent(artSvg({ animal: s.animal.name, element: s.element, yang: s.yang, season: s.season, hanja: "", bare: true }, 520));
  } catch { /* 없는 지도면 기본 카드 */ }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#000", color: "#fff", padding: 48, alignItems: "center", gap: 40,
        backgroundImage: "linear-gradient(rgba(0,240,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.06) 1px, transparent 1px)", backgroundSize: "48px 48px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {art ? <img src={art} width={520} height={520} alt="" /> : <div style={{ width: 0, display: "flex" }} />}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 26, letterSpacing: 6, color: "#00f0ff", display: "flex" }}>WITHSAJU</div>
          <div style={{ fontSize: name ? 34 : 0, color: "#aaa", marginTop: 24, display: "flex" }}>{name ? `${name} is the` : ""}</div>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1, marginTop: 8, display: "flex" }}>{title}</div>
          <div style={{ fontSize: 26, color: "#bbb", marginTop: 20, lineHeight: 1.4, display: "flex" }}>{tagline}</div>
          <div style={{ marginTop: 36, background: "#00f0ff", color: "#000", fontSize: 32, fontWeight: 800, padding: "14px 24px", display: "flex", alignSelf: "flex-start" }}>{"What's yours?"}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=600" } },
  );
}
