import http from "k6/http";
import { check, sleep } from "k6";
import { login } from "./helpers/auth.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOGIN_EMAIL || "admin@example.com";
const PASSWORD = __ENV.LOGIN_PASSWORD || "password";
const GROUP_ID = __ENV.GROUP_ID || "1";

export const options = {
  stages: [
    { duration: "20s", target: 20 },
    { duration: "59m40s", target: 20 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<10000"],
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  if (__ITER === 0) {
    login(BASE_URL, EMAIL, PASSWORD);
  }

  const rand = Math.random() * 100;

  if (rand < 40) {
    // テストグループ一覧 (40%)
    const res = http.get(`${BASE_URL}/api/test-groups`, {
      headers: { Accept: "application/json" },
      tags: { name: "GET /api/test-groups" },
    });
    check(res, { "list status 200": (r) => r.status === 200 });
  } else if (rand < 70) {
    // テストケース一覧 (30%)
    const res = http.get(
      `${BASE_URL}/api/test-groups/${GROUP_ID}/cases`,
      {
        headers: { Accept: "application/json" },
        tags: { name: "GET /api/test-groups/{id}/cases" },
      }
    );
    check(res, { "cases status 200": (r) => r.status === 200 });
  } else if (rand < 90) {
    // 集計 (20%)
    const res = http.get(
      `${BASE_URL}/api/test-groups/${GROUP_ID}/report-data`,
      {
        headers: { Accept: "application/json" },
        tags: { name: "GET /api/test-groups/{id}/report-data" },
      }
    );
    check(res, { "report status 200": (r) => r.status === 200 });
  } else {
    // ヘルスチェック (10%)
    const res = http.get(`${BASE_URL}/api/health`, {
      tags: { name: "GET /api/health" },
    });
    check(res, { "health status 200": (r) => r.status === 200 });
  }

  sleep(0.5);
}
