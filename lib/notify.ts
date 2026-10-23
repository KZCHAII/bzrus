// 텔레그램 알림 (BZR 방식 그대로). TELEGRAM_BOT_TOKEN·TELEGRAM_CHAT_ID 가 없으면 조용히 건너뜀. 알림 실패가 손님 요청을 막지 않는다.
import { envOptional } from "./env";

export const escHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export async function notify(html: string): Promise<void> {
  const token = envOptional("TELEGRAM_BOT_TOKEN");
  const chat = envOptional("TELEGRAM_CHAT_ID");
  if (!token || !chat || process.env.VITEST) return;
  const send = (body: Record<string, unknown>) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, disable_web_page_preview: true, ...body }),
  });
  try {
    const r = await send({ text: `[WITHSAJU] ${html}`, parse_mode: "HTML" });
    // HTML로 못 읽으면 태그를 떼고 글자 그대로라도 보낸다
    if (!r.ok) {
      console.error("[telegram]", r.status);
      await send({ text: `[WITHSAJU] ${html.replace(/<[^>]+>/g, "")}` });
    }
  } catch (e) { console.error("[telegram]", e instanceof Error ? e.message : e); }
}
