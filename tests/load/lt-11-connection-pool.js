import http from "k6/http";
import { check } from "k6";
import { login } from "./helpers/auth.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOGIN_EMAIL || "admin@example.com";
const PASSWORD = __ENV.LOGIN_PASSWORD || "password";

export const options = {
  scenarios: {
    pool_stress: {
      executor: "per-vu-iterations",
      vus: 50,
      iterations: 10,
      maxDuration: "120s",
    },
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
    "no hang (response received)": (r) => r.status !== 0,
    "no 5xx error": (r) => r.status < 500,
  });
}
