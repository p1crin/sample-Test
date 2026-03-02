import http from "k6/http";
import { check, sleep } from "k6";
import { login } from "./helpers/auth.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOGIN_EMAIL || "admin@example.com";
const PASSWORD = __ENV.LOGIN_PASSWORD || "password";

export const options = {
  stages: [
    { duration: "5s", target: 5 }, // 通常負荷
    { duration: "55s", target: 5 }, // 1分間維持
    { duration: "5s", target: 50 }, // 急増（5→50）
    { duration: "55s", target: 50 }, // 1分間維持
    { duration: "5s", target: 5 }, // 減少（50→5）
    { duration: "55s", target: 5 }, // 通常に復帰
  ],
  thresholds: {
    "http_req_failed{expected_response:true}": ["rate<0.01"],
  },
};

export default function () {
  if (__ITER === 0) {
    login(BASE_URL, EMAIL, PASSWORD);
  }

  const res = http.get(`${BASE_URL}/api/test-groups`, {
    headers: { Accept: "application/json" },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "no 5xx error": (r) => r.status < 500,
  });

  sleep(0.5);
}
