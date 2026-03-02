import http from "k6/http";
import { check, sleep } from "k6";
import { login } from "./helpers/auth.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOGIN_EMAIL || "admin@example.com";
const PASSWORD = __ENV.LOGIN_PASSWORD || "password";

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "29m50s", target: 10 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000"],
    http_req_failed: ["rate<0.01"],
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
  });

  sleep(1);
}
