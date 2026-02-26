#!/bin/bash
# =============================================================================
# API レスポンスタイム計測スクリプト
# 使い方: ./scripts/measure_api.sh <テストID> <回数> <メソッド> <URL> [データ] [判定基準ms]
#
# 事前準備:
#   export BASE_URL="http://prooflink-alb-XXXXX.ap-northeast-1.elb.amazonaws.com"
#   export LOGIN_EMAIL="admin@example.com"
#   export LOGIN_PASSWORD="your-password"
#   source scripts/login.sh
# =============================================================================

TEST_ID="$1"
COUNT="${2:-5}"
METHOD="${3:-GET}"
URL="$4"
DATA="$5"
THRESHOLD="$6"

if [ -z "$URL" ]; then
  echo "使い方: $0 <テストID> <回数> <METHOD> <URL> [POSTデータ] [判定基準ms]"
  echo ""
  echo "例:"
  echo "  $0 ST01-IT2-PT-14 5 GET \${BASE_URL}/api/test-groups '' 2000"
  echo "  $0 ST01-IT2-PT-1 5 POST \${BASE_URL}/api/test-groups/1 '{\"action\":\"duplicate\"}' 3000"
  exit 1
fi

if [ -z "$COOKIE_FILE" ]; then
  echo "ERROR: COOKIE_FILE が設定されていません。先に source scripts/login.sh を実行してください。"
  exit 1
fi

echo "========================================"
echo "テストID: ${TEST_ID}"
echo "URL: ${URL}"
echo "メソッド: ${METHOD}"
echo "計測回数: ${COUNT}"
[ -n "$THRESHOLD" ] && echo "判定基準: ${THRESHOLD}ms以内"
echo "========================================"

TOTAL=0
RESULTS=()
HAS_ERROR=0

for i in $(seq 1 "$COUNT"); do
  if [ "$METHOD" = "POST" ] && [ -n "$DATA" ]; then
    RESPONSE=$(curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
      -X POST "$URL" \
      -H "Content-Type: application/json" \
      -d "$DATA" \
      -o /dev/null -w "%{http_code} %{time_total}")
  else
    RESPONSE=$(curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
      "$URL" \
      -o /dev/null -w "%{http_code} %{time_total}")
  fi

  HTTP_CODE=$(echo "$RESPONSE" | awk '{print $1}')
  TIME_SEC=$(echo "$RESPONSE" | awk '{print $2}')
  TIME_MS=$(echo "$TIME_SEC" | awk '{printf "%.0f", $1 * 1000}')

  RESULTS+=("$TIME_MS")
  TOTAL=$((TOTAL + TIME_MS))

  if [ "$HTTP_CODE" -ge 400 ]; then
    echo "  計測${i}回目: ${TIME_MS}ms (HTTP ${HTTP_CODE}) *** ERROR ***"
    HAS_ERROR=1
  else
    echo "  計測${i}回目: ${TIME_MS}ms (HTTP ${HTTP_CODE})"
  fi
done

AVG=$((TOTAL / COUNT))

echo "----------------------------------------"
echo "平均: ${AVG}ms"
echo "各回: ${RESULTS[*]}"

if [ "$HAS_ERROR" -eq 1 ]; then
  echo "判定: NG (HTTPエラーが発生)"
elif [ -n "$THRESHOLD" ]; then
  if [ "$AVG" -le "$THRESHOLD" ]; then
    echo "判定: OK (${AVG}ms <= ${THRESHOLD}ms)"
  else
    echo "判定: NG (${AVG}ms > ${THRESHOLD}ms)"
  fi
fi
echo "========================================"
echo ""
