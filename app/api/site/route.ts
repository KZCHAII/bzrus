import { handle, json } from "@/lib/http";
import { envOptional } from "@/lib/env";

// 공개 설정: 약관 화면의 연락처 등 (비밀 값 아님)
export const GET = handle(async () => json({ contactEmail: envOptional("CONTACT_EMAIL") ?? null }));
