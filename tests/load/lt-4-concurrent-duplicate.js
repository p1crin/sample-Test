import http from "k6/http";
import { check } from "k6";
import { login } from "./helpers/auth.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOGIN_EMAIL || "admin@example.com";
const PASSWORD = __ENV.LOGIN_PASSWORD || "password";

// カンマ区切りで3つのグループIDを指定
const GROUP_IDS = (__ENV.GROUP_IDS || "1,2,3").split(",");

export const options = {
  scenarios: {
    concurrent_duplicate: {
      executor: "shared-iterations",
      vus: GROUP_IDS.length,
      iterations: GROUP_IDS.length,
      maxDuration: "120s",
    },
  },
};

export default function () {
  login(BASE_URL, EMAIL, PASSWORD);

  const groupId = GROUP_IDS[__VU - 1];
  const res = http.post(
    `${BASE_URL}/api/test-groups/${groupId}`,
    JSON.stringify({ action: "duplicate" }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(res, {
    "status is 200": (r) => r.status === 200,
    "no deadlock": (r) => r.status !== 500,
  });
}
