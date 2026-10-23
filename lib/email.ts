// 메일 보내기. 기본은 테스트 모드: 실제로 보내지 않고 email_outbox에 기록만 (화면·테스트에서 확인).
// EMAIL_MODE=live + RESEND_API_KEY + EMAIL_FROM 이 다 있을 때만 실제 발송. 실제 발송 기록에는 본문(로그인 링크)을 남기지 않는다.
import { getSql } from "./db";
import { envOptional } from "./env";

export type EmailKind = "login" | "reading_ready" | "page_saved";
export interface Mail { to: string; kind: EmailKind; subject: string; text: string; html: string }

export const emailLive = () => envOptional("EMAIL_MODE") === "live" && !!envOptional("RESEND_API_KEY") && !!envOptional("EMAIL_FROM");

export async function sendEmail(m: Mail, isTest = false): Promise<{ status: "test" | "sent" | "failed" }> {
  const sql = getSql();
  if (!emailLive()) {
    await sql`insert into email_outbox (to_email, kind, subject, body_text, status, is_test) values (${m.to}, ${m.kind}, ${m.subject}, ${m.text}, 'test', ${isTest})`;
    return { status: "test" };
  }
  const [row] = await sql<{ id: string }[]>`insert into email_outbox (to_email, kind, subject, body_text, status, is_test)
    values (${m.to}, ${m.kind}, ${m.subject}, '[sent; body not stored]', 'sending', ${isTest}) returning id`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${envOptional("RESEND_API_KEY")}` },
      body: JSON.stringify({ from: envOptional("EMAIL_FROM"), to: [m.to], subject: m.subject, text: m.text, html: m.html }),
    });
    const data = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!r.ok) throw new Error(`RESEND_${r.status}:${(data.message ?? "").slice(0, 200)}`);
    await sql`update email_outbox set status = 'sent', provider_id = ${data.id ?? null}, sent_at = now() where id = ${row.id}`;
    return { status: "sent" };
  } catch (e) {
    await sql`update email_outbox set status = 'failed', error = ${(e instanceof Error ? e.message : String(e)).slice(0, 300)} where id = ${row.id}`;
    return { status: "failed" };
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** 간단한 메일 본문 (검정 배경 + 시안 버튼, 사이트와 같은 느낌) */
export function mailHtml(title: string, lines: string[], button: { label: string; url: string }, foot: string): string {
  return `<!doctype html><html><body style="margin:0;background:#000;padding:32px 16px;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#e0e0e0">
<div style="max-width:480px;margin:0 auto;border:1px solid #2e2e2e;background:#080808;padding:28px">
<div style="font-family:monospace;letter-spacing:.2em;font-size:12px;color:#fff">WITH<span style="color:#00f0ff">SAJU</span></div>
<h1 style="font-size:22px;color:#fff;margin:22px 0 12px">${esc(title)}</h1>
${lines.map((l) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px">${esc(l)}</p>`).join("")}
<p style="margin:22px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#00f0ff;color:#000;text-decoration:none;font-family:monospace;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:13px;padding:14px 22px">${esc(button.label)}</a></p>
<p style="font-size:12px;color:#888;line-height:1.5;margin:0">${esc(foot)}</p>
</div><p style="text-align:center;font-family:monospace;font-size:10px;color:#666;margin-top:16px">WITHSAJU · For entertainment purposes only.</p></body></html>`;
}
