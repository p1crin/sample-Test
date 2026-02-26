#!/bin/bash
# =============================================================================
# ProofLink ログインスクリプト（セッションCookie取得）
#
# 使い方:
#   export BASE_URL="http://prooflink-alb-XXXXX.ap-northeast-1.elb.amazonaws.com"
#   export LOGIN_EMAIL="admin@example.com"
#   export LOGIN_PASSWORD="your-password"
#   source scripts/login.sh
#
# 実行後、$COOKIE_FILE にセッションCookieが保存されます。
# =============================================================================

if [ -z "$BASE_URL" ]; then
  echo "ERROR: BASE_URL が設定されていません。"
  echo "  export BASE_URL=\"http://prooflink-alb-XXXXX.ap-northeast-1.elb.amazonaws.com\""
  return 1 2>/dev/null || exit 1
fi

if [ -z "$LOGIN_EMAIL" ] || [ -z "$LOGIN_PASSWORD" ]; then
  echo "ERROR: LOGIN_EMAIL / LOGIN_PASSWORD が設定されていません。"
  echo "  export LOGIN_EMAIL=\"admin@example.com\""
  echo "  export LOGIN_PASSWORD=\"your-password\""
  return 1 2>/dev/null || exit 1
fi

# Cookieファイルの初期化
export COOKIE_FILE=$(mktemp /tmp/prooflink_cookie.XXXXXX)

echo "--- ProofLink ログイン ---"

# 1. CSRFトークンを取得
CSRF_RESPONSE=$(curl -s -c "$COOKIE_FILE" -b "$COOKIE_FILE" "${BASE_URL}/api/auth/csrf")
CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])" 2>/dev/null)

if [ -z "$CSRF_TOKEN" ]; then
  echo "ERROR: CSRFトークンの取得に失敗しました。"
  echo "レスポンス: ${CSRF_RESPONSE}"
  return 1 2>/dev/null || exit 1
fi

echo "CSRFトークン取得: OK"

# 2. ログイン
LOGIN_STATUS=$(curl -s -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
  -X POST "${BASE_URL}/api/auth/callback/credentials" \
  -d "csrfToken=${CSRF_TOKEN}&email=${LOGIN_EMAIL}&password=${LOGIN_PASSWORD}&json=true" \
  -L -o /dev/null -w "%{http_code}")

if [ "$LOGIN_STATUS" -ge 400 ]; then
  echo "ERROR: ログインに失敗しました (HTTP ${LOGIN_STATUS})"
  return 1 2>/dev/null || exit 1
fi

echo "ログイン: OK (HTTP ${LOGIN_STATUS})"
echo "Cookie保存先: ${COOKIE_FILE}"
echo "--- ログイン完了 ---"
echo ""
