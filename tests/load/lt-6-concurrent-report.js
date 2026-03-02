import http from "k6/http";
import { check } from "k6";
import { login } from "./helpers/auth.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOGIN_EMAIL || "admin@example.com";
const PASSWORD = __ENV.LOGIN_PASSWORD || "password";
const GROUP_ID = __ENV.GROUP_ID || "1";

export const options = {
  scenarios: {
    concurrent_report: {
      executor: "shared-iterations",
      vus: 10,
      iterations: 10,
      maxDuration: "60s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<5000"],
  },
};

export default function () {
  login(BASE_URL, EMAIL, PASSWORD);

  const res = http.get(
    `${BASE_URL}/api/test-groups/${GROUP_ID}/report-data`,
    { headers: { Accept: "application/json" } }
  );

  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}
