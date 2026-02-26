import http from "k6/http";

/**
 * NextAuth.js の CSRF トークン取得 → ログインを行い、セッション Cookie を確立する。
 * k6 は VU ごとに Cookie Jar を自動管理するため、
 * この関数を一度呼べば以降のリクエストに Cookie が付与される。
 *
 * @param {string} baseUrl - アプリケーションのベースURL
 * @param {string} email - ログインメールアドレス
 * @param {string} password - ログインパスワード
 * @returns {object} ログインレスポンス
 */
export function login(baseUrl, email, password) {
  // 1. CSRF トークン取得
  const csrfRes = http.get(`${baseUrl}/api/auth/csrf`);
  const csrfToken = JSON.parse(csrfRes.body).csrfToken;

  // 2. ログイン
  const loginRes = http.post(
    `${baseUrl}/api/auth/callback/credentials`,
    {
      csrfToken: csrfToken,
      email: email,
      password: password,
      json: "true",
    },
    {
      redirects: 5,
    }
  );

  return loginRes;
}
