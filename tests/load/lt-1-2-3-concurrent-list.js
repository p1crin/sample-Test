import http from "k6/http";
import { check } from "k6";
import { login } from "./helpers/auth.js";

// ---- 設定 ----
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOGIN_EMAIL || "admin@example.com";
const PASSWORD = __ENV.LOGIN_PASSWORD || "password";

// テスト対象に応じて VUS を変更
// LT-1: 10, LT-2: 30, LT-3: 50
const VUS = parseInt(__ENV.VUS || "10");

export const options = {
  scenarios: {
    concurrent_access: {
      executor: "shared-iterations",
      vus: VUS,
      iterations: VUS,
      maxDuration: "60s",
    },
  },
  thresholds: {
    // LT-1: p95 < 3s, LT-2: p95 < 5s, LT-3: p95 < 10s
    http_req_duration: [`p(95)<${__ENV.THRESHOLD_MS || "3000"}`],
    http_req_failed: [`rate<${__ENV.ERROR_RATE || "0.01"}`],
  },
};

export default function () {
  // 認証
  login(BASE_URL, EMAIL, PASSWORD);

  // テストグループ一覧 API
  const res = http.get(`${BASE_URL}/api/test-groups`, {
    headers: { Accept: "application/json" },
    tags: { name: "GET /api/test-groups" },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}
