import { handle, json, readJson } from "@/lib/http";
import { clientIp, createMap, viewMap } from "@/lib/maps";

// 지도 만들기
export const POST = handle(async (req) => {
  const body = await readJson(req);
  return json(await createMap({ name: body.name, birthday: body.birthday, time: body.time }, clientIp(req)));
});

// 지도 보기 ?slug=  (주인은 x-owner-token 헤더)
export const GET = handle(async (req) => {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  return json(await viewMap(slug, (req.headers.get("x-owner-token") ?? "").slice(0, 100)));
});
