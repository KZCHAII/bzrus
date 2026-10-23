// 서버에서도 화면과 똑같은 네온 그림을 그리기 위해 브라우저용 스크립트를 그대로 불러온다 (그림 규칙은 한 곳).
import "../public/js/animals.js";
import "../public/js/sign-art.js";

type ArtInput = { animal: string; element: string; yang: boolean; season: string; hanja: string; bare?: boolean };
export function artSvg(o: ArtInput, size = 600): string {
  const g = globalThis as unknown as { WSArt?: { svg: (o: ArtInput, size?: number) => string } };
  return g.WSArt ? g.WSArt.svg(o, size) : "";
}
