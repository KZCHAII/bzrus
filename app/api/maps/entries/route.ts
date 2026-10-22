import { handle, json, readJson } from "@/lib/http";
import { addEntry, clientIp, removeEntry } from "@/lib/maps";

// 친구가 지도에 생일 넣기 ?slug=
export const POST = handle(async (req) => {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  const body = await readJson(req);
  return json(await addEntry(slug, { nickname: body.nickname, birthday: body.birthday, consent: body.consent }, clientIp(req)));
});

// 주인이 지도에서 지우기 ?slug=&id=
export const DELETE = handle(async (req) => {
  const q = new URL(req.url).searchParams;
  return json(await removeEntry(q.get("slug") ?? "", q.get("id") ?? "", (req.headers.get("x-owner-token") ?? "").slice(0, 100)));
});
