import { execFileSync } from "node:child_process";
import { join } from "node:path";

// 로컬 Postgres를 띄운다 (TEST_DATABASE_URL을 직접 주면 생략)
export default function setup() {
  if (process.env.TEST_DATABASE_URL) return;
  execFileSync("bash", [join(__dirname, "../../scripts/pg-local.sh"), "start"], { stdio: "pipe" });
}
