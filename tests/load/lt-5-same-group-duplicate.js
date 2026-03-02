import http from "k6/http";
import { check } from "k6";
import { login } from "./helpers/auth.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOGIN_EMAIL || "admin@example.com";
const PASSWORD = __ENV.LOGIN_PASSWORD || "password";
const GROUP_ID = __ENV.GROUP_ID || "1";

export const options = {
  scenarios: {
    same_group_duplicate: {
      executor: "shared-iterations",
      vus: 3,
      iterations: 3,
      maxDuration: "120s",
    },
  },
};

export default function () {
  login(BASE_URL, EMAIL, PASSWORD);

  const res = http.post(
    `${BASE_URL}/api/test-groups/${GROUP_ID}`,
    JSON.stringify({ action: "duplicate" }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(res, {
    "request completed": (r) => r.status === 200 || r.status < 500,
    "no server error": (r) => r.status !== 500,
  });
}
