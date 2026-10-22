import { after } from "next/server";

// 응답을 먼저 보내고 뒤에서 이어서 할 일 (리포트 생성 등). 테스트에서는 setBackground로 바꿔 끼운다.
type Runner = (fn: () => Promise<unknown>) => void;

let runner: Runner = (fn) => after(() => fn().catch((e) => console.error("[background]", e)));

export const background: Runner = (fn) => runner(fn);
export function setBackground(r: Runner | null) {
  runner = r ?? ((fn) => after(() => fn().catch((e) => console.error("[background]", e))));
}
