# 性能テスト・負荷テスト 簡易実施手順書（curl / k6）

## 目次

1. [はじめに](#1-はじめに)
2. [前提条件](#2-前提条件)
3. [性能テスト（curlスクリプト）](#3-性能テストcurlスクリプト)
4. [負荷テスト（k6）](#4-負荷テストk6)
5. [テスト結果の確認と記録](#5-テスト結果の確認と記録)
6. [CloudWatchによるサーバー側監視](#6-cloudwatchによるサーバー側監視)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. はじめに

### 本ドキュメントの目的

本ドキュメントは、IT2総合試験項目書（性能テスト・負荷テスト）のうち「計測ツール: JMeter」と記載された項目を、JMeterを使わずにより簡単に実施する手順を説明します。

- **性能テスト（PT-1～PT-17）**: `curl` + シェルスクリプトで実施
- **負荷テスト（LT-1～LT-11）**: `k6` で実施

### JMeter手順書との関係

JMeterでの実施手順は `docs/JMETER_TEST_GUIDE.md` を参照してください。本ドキュメントの手順でも同等の計測結果が得られます。

---

## 2. 前提条件

### 2.1 テスト対象環境

| 項目 | 値 |
|------|-----|
| 対象システム | ProofLink（AWS上のNext.jsアプリケーション） |
| アプリケーションURL | ALBのDNS名（開発環境）または `https://prooflink.example.com`（本番環境） |
| 構成 | ALB → ECS Fargate（プライベートサブネット） → RDS PostgreSQL |
| リージョン | ap-northeast-1（東京） |
| WAF | IP制限あり（テスト実施端末のIPを許可リストに追加すること） |

### 2.2 ツールのインストール

#### curl（性能テスト用）

ほとんどのOS（Linux / macOS / Windows 10以降）に標準搭載されています。

```bash
curl --version
```

#### k6（負荷テスト用）

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows
choco install k6
# または winget install k6

# Docker
docker run --rm -i grafana/k6 version
```

インストール確認:

```bash
k6 version
```

### 2.3 事前準備

| 準備項目 | 詳細 |
|---------|------|
| ネットワーク | テスト実施端末からALBへHTTPS接続可能であること |
| WAF許可 | テスト実施端末のグローバルIPがWAFの許可リスト(`prooflink-allowed-ips`)に追加されていること |
| テストデータ | 試験項目書の前提条件に記載されたテストデータが投入済みであること |
| テストアカウント | 各テストに必要なユーザアカウントが作成済みであること |

---

## 3. 性能テスト（curlスクリプト）

### 3.1 環境変数の設定

テスト実行前に環境変数を設定します。ご自身の環境に合わせて値を変更してください。

```bash
# === 環境設定 ===
# 開発環境の場合
export BASE_URL="http://prooflink-alb-XXXXX.ap-northeast-1.elb.amazonaws.com"

# 本番環境の場合
# export BASE_URL="https://prooflink.example.com"

export LOGIN_EMAIL="admin@example.com"
export LOGIN_PASSWORD="your-password"
```

### 3.2 認証（セッションCookie取得）

全APIリクエストに先立ち、セッションCookieを取得します。以下のコマンドを実行してください。

```bash
# Cookieファイルの初期化
COOKIE_FILE=$(mktemp)

# 1. CSRFトークンを取得
CSRF_TOKEN=$(curl -s -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
  "${BASE_URL}/api/auth/csrf" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")

echo "CSRF Token: ${CSRF_TOKEN}"

# 2. ログイン（セッションCookieを取得）
curl -s -c "$COOKIE_FILE" -b "$COOKIE_FILE" \
  -X POST "${BASE_URL}/api/auth/callback/credentials" \
  -d "csrfToken=${CSRF_TOKEN}&email=${LOGIN_EMAIL}&password=${LOGIN_PASSWORD}&json=true" \
  -L -o /dev/null -w "Login HTTP Status: %{http_code}\n"

echo "Cookie file: ${COOKIE_FILE}"
```

> ログイン後、`$COOKIE_FILE`に保存されたCookieを以降の全リクエストで使用します。

### 3.3 レスポンスタイム計測スクリプト

以下のスクリプトを `scripts/measure_api.sh` として保存し、各テスト項目で使用します。

```bash
#!/bin/bash
# =============================================================================
# API レスポンスタイム計測スクリプト
# 使い方: ./measure_api.sh <テストID> <回数> <メソッド> <URL> [データ] [判定基準ms]
# =============================================================================

TEST_ID="$1"
COUNT="${2:-5}"
METHOD="${3:-GET}"
URL="$4"
DATA="$5"
THRESHOLD="$6"

if [ -z "$URL" ]; then
  echo "使い方: $0 <テストID> <回数> <METHOD> <URL> [POSTデータ] [判定基準ms]"
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
  else
    echo "  計測${i}回目: ${TIME_MS}ms (HTTP ${HTTP_CODE})"
  fi
done

AVG=$((TOTAL / COUNT))

echo "----------------------------------------"
echo "平均: ${AVG}ms"
echo "各回: ${RESULTS[*]}"

if [ -n "$THRESHOLD" ]; then
  if [ "$AVG" -le "$THRESHOLD" ]; then
    echo "判定: OK (${AVG}ms <= ${THRESHOLD}ms)"
  else
    echo "判定: NG (${AVG}ms > ${THRESHOLD}ms)"
  fi
fi
echo "========================================"
echo ""
```

```bash
chmod +x scripts/measure_api.sh
```

### 3.4 各テスト項目の実行

#### PT-1～PT-3: テストグループ複製 レスポンスタイム

```bash
# PT-1: 小規模グループ（テストケース50件） - 判定基準: 3秒
./scripts/measure_api.sh "ST01-IT2-PT-1" 5 POST \
  "${BASE_URL}/api/test-groups/<GROUP_ID_50>" \
  '{"action":"duplicate"}' 3000

# PT-2: 中規模グループ（テストケース200件） - 判定基準: 10秒
./scripts/measure_api.sh "ST01-IT2-PT-2" 5 POST \
  "${BASE_URL}/api/test-groups/<GROUP_ID_200>" \
  '{"action":"duplicate"}' 10000

# PT-3: 大規模グループ（テストケース500件） - 判定基準: 30秒
./scripts/measure_api.sh "ST01-IT2-PT-3" 5 POST \
  "${BASE_URL}/api/test-groups/<GROUP_ID_500>" \
  '{"action":"duplicate"}' 30000
```

> `<GROUP_ID_50>`, `<GROUP_ID_200>`, `<GROUP_ID_500>` は各規模に対応するテストグループIDに置き換えてください。

#### PT-5～PT-7: テストグループ集計 レスポンスタイム

```bash
# PT-5: 小規模（50件） - 判定基準: 1秒
./scripts/measure_api.sh "ST01-IT2-PT-5" 5 GET \
  "${BASE_URL}/api/test-groups/<GROUP_ID_50>/report-data" "" 1000

# PT-6: 中規模（200件） - 判定基準: 3秒
./scripts/measure_api.sh "ST01-IT2-PT-6" 5 GET \
  "${BASE_URL}/api/test-groups/<GROUP_ID_200>/report-data" "" 3000

# PT-7: 大規模（500件） - 判定基準: 5秒
./scripts/measure_api.sh "ST01-IT2-PT-7" 5 GET \
  "${BASE_URL}/api/test-groups/<GROUP_ID_500>/report-data" "" 5000
```

#### PT-8: 日次レポート レスポンスタイム

```bash
# PT-8: 日次レポート - 判定基準: 3秒
./scripts/measure_api.sh "ST01-IT2-PT-8" 5 GET \
  "${BASE_URL}/api/test-groups/<GROUP_ID_500>/daily-report-data" "" 3000
```

#### PT-14: テストグループ一覧 レスポンスタイム

```bash
# PT-14: テストグループ一覧（100件） - 判定基準: 2秒
./scripts/measure_api.sh "ST01-IT2-PT-14" 5 GET \
  "${BASE_URL}/api/test-groups" "" 2000
```

#### PT-15: テストケース一覧 レスポンスタイム

```bash
# PT-15: テストケース一覧（500件） - 判定基準: 3秒
./scripts/measure_api.sh "ST01-IT2-PT-15" 5 GET \
  "${BASE_URL}/api/test-groups/<GROUP_ID_500>/cases" "" 3000
```

#### PT-16: 認証処理 レスポンスタイム

認証処理は CSRFトークン取得 + ログインの合計時間を計測します。

```bash
#!/bin/bash
# PT-16: 認証処理レスポンスタイム計測
echo "========================================"
echo "テストID: ST01-IT2-PT-16"
echo "計測回数: 5"
echo "判定基準: 2000ms以内"
echo "========================================"

TOTAL=0
for i in $(seq 1 5); do
  TMP_COOKIE=$(mktemp)
  START=$(date +%s%N)

  # CSRFトークン取得
  CSRF=$(curl -s -c "$TMP_COOKIE" -b "$TMP_COOKIE" \
    "${BASE_URL}/api/auth/csrf" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")

  # ログイン
  curl -s -c "$TMP_COOKIE" -b "$TMP_COOKIE" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -d "csrfToken=${CSRF}&email=${LOGIN_EMAIL}&password=${LOGIN_PASSWORD}&json=true" \
    -L -o /dev/null

  END=$(date +%s%N)
  ELAPSED_MS=$(( (END - START) / 1000000 ))
  TOTAL=$((TOTAL + ELAPSED_MS))
  echo "  計測${i}回目: ${ELAPSED_MS}ms"
  rm -f "$TMP_COOKIE"
done

AVG=$((TOTAL / 5))
echo "----------------------------------------"
echo "平均: ${AVG}ms"
if [ "$AVG" -le 2000 ]; then
  echo "判定: OK (${AVG}ms <= 2000ms)"
else
  echo "判定: NG (${AVG}ms > 2000ms)"
fi
echo "========================================"
```

#### PT-17: ファイルアップロード レスポンスタイム

```bash
# 10MBのテストファイルを生成（未作成の場合）
dd if=/dev/urandom of=/tmp/test_evidence_10mb.png bs=1M count=10 2>/dev/null

# PT-17: エビデンスアップロード - 判定基準: 5秒
echo "========================================"
echo "テストID: ST01-IT2-PT-17"
echo "========================================"

TOTAL=0
for i in $(seq 1 5); do
  RESPONSE=$(curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -X POST "${BASE_URL}/api/files/evidences" \
    -F "file=@/tmp/test_evidence_10mb.png;type=image/png" \
    -F "testResultId=<TEST_RESULT_ID>" \
    -o /dev/null -w "%{http_code} %{time_total}")

  HTTP_CODE=$(echo "$RESPONSE" | awk '{print $1}')
  TIME_MS=$(echo "$RESPONSE" | awk '{printf "%.0f", $2 * 1000}')
  TOTAL=$((TOTAL + TIME_MS))
  echo "  計測${i}回目: ${TIME_MS}ms (HTTP ${HTTP_CODE})"
done

AVG=$((TOTAL / 5))
echo "平均: ${AVG}ms"
if [ "$AVG" -le 5000 ]; then echo "判定: OK"; else echo "判定: NG"; fi
echo "========================================"
```

> `<TEST_RESULT_ID>` は対象のテスト結果IDに置き換えてください。

### 3.5 全性能テスト一括実行

全性能テスト項目を連続で実行するスクリプトです。

```bash
#!/bin/bash
# =============================================================================
# 全性能テスト一括実行スクリプト
# 使い方: 環境変数 BASE_URL, LOGIN_EMAIL, LOGIN_PASSWORD を設定後に実行
# =============================================================================

# グループIDを設定（環境に合わせて変更）
GROUP_50=<GROUP_ID_50>
GROUP_200=<GROUP_ID_200>
GROUP_500=<GROUP_ID_500>

echo "=== 性能テスト一括実行開始: $(date) ==="
echo ""

# 認証
source scripts/login.sh

# テストグループ複製
./scripts/measure_api.sh "ST01-IT2-PT-1" 5 POST "${BASE_URL}/api/test-groups/${GROUP_50}" '{"action":"duplicate"}' 3000
./scripts/measure_api.sh "ST01-IT2-PT-2" 5 POST "${BASE_URL}/api/test-groups/${GROUP_200}" '{"action":"duplicate"}' 10000
./scripts/measure_api.sh "ST01-IT2-PT-3" 5 POST "${BASE_URL}/api/test-groups/${GROUP_500}" '{"action":"duplicate"}' 30000

# テストグループ集計
./scripts/measure_api.sh "ST01-IT2-PT-5" 5 GET "${BASE_URL}/api/test-groups/${GROUP_50}/report-data" "" 1000
./scripts/measure_api.sh "ST01-IT2-PT-6" 5 GET "${BASE_URL}/api/test-groups/${GROUP_200}/report-data" "" 3000
./scripts/measure_api.sh "ST01-IT2-PT-7" 5 GET "${BASE_URL}/api/test-groups/${GROUP_500}/report-data" "" 5000

# 日次レポート
./scripts/measure_api.sh "ST01-IT2-PT-8" 5 GET "${BASE_URL}/api/test-groups/${GROUP_500}/daily-report-data" "" 3000

# テストグループ一覧
./scripts/measure_api.sh "ST01-IT2-PT-14" 5 GET "${BASE_URL}/api/test-groups" "" 2000

# テストケース一覧
./scripts/measure_api.sh "ST01-IT2-PT-15" 5 GET "${BASE_URL}/api/test-groups/${GROUP_500}/cases" "" 3000

echo "=== 性能テスト一括実行完了: $(date) ==="
```

---

## 4. 負荷テスト（k6）

### 4.1 k6の基本

k6はJavaScriptでテストシナリオを記述する負荷テストツールです。JMeterと比較して以下の利点があります。

| 項目 | k6 | JMeter |
|------|-----|--------|
| テスト定義 | JavaScriptファイル | XML（GUI操作） |
| 実行方法 | コマンド1つ | GUI or CLI + 設定ファイル |
| リソース消費 | 軽量（Go製） | 重い（Java製） |
| バージョン管理 | テストコードをGit管理可能 | .jmxファイルの差分が読みにくい |

### 4.2 共通ヘルパー（認証処理）

全テストスクリプトで共有する認証ヘルパーを作成します。

**ファイル: `tests/load/helpers/auth.js`**

```javascript
import http from "k6/http";

/**
 * NextAuth.js の CSRF トークン取得 → ログインを行い、セッション Cookie を確立する。
 * k6 は Cookie Jar を自動管理するため、この関数を一度呼べば以降のリクエストに Cookie が付与される。
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
```

### 4.3 LT-1～LT-3: 同時接続テスト - テストグループ一覧

**ファイル: `tests/load/lt-1-2-3-concurrent-list.js`**

```javascript
import http from "k6/http";
import { check, sleep } from "k6";
import { login } from "./helpers/auth.js";

// ---- 設定 ----
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOGIN_EMAIL || "admin@example.com";
const PASSWORD = __ENV.LOGIN_PASSWORD || "password";

// テスト対象に応じて VUS を変更
// LT-1: 10, LT-2: 30, LT-3: 50
const VUS = parseInt(__ENV.VUS || "10");

export const options = {
  scenarios: {
    concurrent_access: {
      executor: "shared-iterations",
      vus: VUS,
      iterations: VUS, // 各VUが1回ずつ実行
      maxDuration: "60s",
    },
  },
  thresholds: {
    // LT-1: p95 < 3s, LT-2: p95 < 5s, LT-3: p95 < 10s
    http_req_duration: [`p(95)<${__ENV.THRESHOLD_MS || "3000"}`],
    http_req_failed: [`rate<${__ENV.ERROR_RATE || "0.01"}`],
  },
};

export function setup() {
  // VU ごとにログインが必要なため setup は使わない
}

export default function () {
  // 認証
  login(BASE_URL, EMAIL, PASSWORD);

  // テストグループ一覧 API
  const res = http.get(`${BASE_URL}/api/test-groups`, {
    headers: { Accept: "application/json" },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}
```

**実行方法:**

```bash
# LT-1: 10ユーザ同時（95%ile 3秒以内、エラー率 0%）
k6 run tests/load/lt-1-2-3-concurrent-list.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}" \
  -e VUS=10 -e THRESHOLD_MS=3000 -e ERROR_RATE=0

# LT-2: 30ユーザ同時（95%ile 5秒以内、エラー率 1%未満）
k6 run tests/load/lt-1-2-3-concurrent-list.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}" \
  -e VUS=30 -e THRESHOLD_MS=5000 -e ERROR_RATE=0.01

# LT-3: 50ユーザ同時（95%ile 10秒以内、エラー率 5%未満）
k6 run tests/load/lt-1-2-3-concurrent-list.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}" \
  -e VUS=50 -e THRESHOLD_MS=10000 -e ERROR_RATE=0.05
```

### 4.4 LT-4: 同時接続テスト - 異なるテストグループの同時複製

**ファイル: `tests/load/lt-4-concurrent-duplicate.js`**

```javascript
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

  const groupId = GROUP_IDS[__VU - 1]; // 各VUに異なるグループを割り当て
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
```

**実行方法:**

```bash
k6 run tests/load/lt-4-concurrent-duplicate.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}" \
  -e GROUP_IDS="1,2,3"
```

### 4.5 LT-5: 同時接続テスト - 同一テストグループの同時複製

**ファイル: `tests/load/lt-5-same-group-duplicate.js`**

```javascript
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
```

**実行方法:**

```bash
k6 run tests/load/lt-5-same-group-duplicate.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}" \
  -e GROUP_ID="<GROUP_ID>"
```

### 4.6 LT-6: 同時接続テスト - テストグループ集計

**ファイル: `tests/load/lt-6-concurrent-report.js`**

```javascript
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
    http_req_duration: ["p(95)<5000"], // 95%ile 5秒以内
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
```

**実行方法:**

```bash
k6 run tests/load/lt-6-concurrent-report.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}" \
  -e GROUP_ID="<GROUP_ID_500>"
```

### 4.7 LT-7: 持続負荷テスト - 30分間

**ファイル: `tests/load/lt-7-sustained-30min.js`**

```javascript
import http from "k6/http";
import { check, sleep } from "k6";
import { login } from "./helpers/auth.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOGIN_EMAIL || "admin@example.com";
const PASSWORD = __ENV.LOGIN_PASSWORD || "password";

export const options = {
  stages: [
    { duration: "10s", target: 10 }, // 10秒かけて10VUまでランプアップ
    { duration: "29m50s", target: 10 }, // 30分間 10VU を維持
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000"], // 95%ile 5秒以内
    http_req_failed: ["rate<0.01"], // エラー率 1%未満
  },
};

export function setup() {
  // 初回ログインのみ setup で実行（共通Cookieは使えないため各VUでログイン）
}

export default function () {
  // 初回のみログイン（k6は iteration 1 以降も同じ VU で Cookie を維持）
  if (__ITER === 0) {
    login(BASE_URL, EMAIL, PASSWORD);
  }

  const res = http.get(`${BASE_URL}/api/test-groups`, {
    headers: { Accept: "application/json" },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  sleep(1); // 1秒間隔
}
```

**実行方法:**

```bash
k6 run tests/load/lt-7-sustained-30min.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}"
```

### 4.8 LT-8: 持続負荷テスト - 混合シナリオ 60分間

**ファイル: `tests/load/lt-8-mixed-60min.js`**

```javascript
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

  // ランダムに API を選択（比率: 一覧40%, ケース30%, 集計20%, アップロード10%）
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
    // ヘルスチェック（ファイルアップロードの代替 - 10%）
    // 実際のファイルアップロードは k6 の open() + http.file() で対応可能
    const res = http.get(`${BASE_URL}/api/health`, {
      tags: { name: "GET /api/health" },
    });
    check(res, { "health status 200": (r) => r.status === 200 });
  }

  sleep(0.5); // 0.5秒間隔
}
```

**実行方法:**

```bash
k6 run tests/load/lt-8-mixed-60min.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}" \
  -e GROUP_ID="<GROUP_ID_500>"
```

### 4.9 LT-9: スパイクテスト

**ファイル: `tests/load/lt-9-spike.js`**

```javascript
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
    // スパイク中でも5xxエラーが出ないこと
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
```

**実行方法:**

```bash
k6 run tests/load/lt-9-spike.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}"
```

### 4.10 LT-10: バッチ処理中の負荷テスト

**実施手順:**

1. AWS Batchコンソールからテストインポートバッチ（テストケース500件）を実行開始
2. バッチが実行中であることを確認後、以下のk6テストを実行

**ファイル: `tests/load/lt-10-during-batch.js`**

```javascript
import http from "k6/http";
import { check, sleep } from "k6";
import { login } from "./helpers/auth.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.LOGIN_EMAIL || "admin@example.com";
const PASSWORD = __ENV.LOGIN_PASSWORD || "password";

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "4m50s", target: 10 }, // 5分間維持
  ],
  thresholds: {
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
```

**実行方法:**

```bash
# バッチ実行中に実施
k6 run tests/load/lt-10-during-batch.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}"
```

**判定**: バッチ非実行時のレスポンスタイムと比較して2倍以内であること。

### 4.11 LT-11: DB接続プールテスト

**ファイル: `tests/load/lt-11-connection-pool.js`**

```javascript
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
      iterations: 10, // 各VUが10回ずつ = 合計500リクエスト
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

  // 間隔を空けない（高頻度リクエスト）
}
```

**実行方法:**

```bash
k6 run tests/load/lt-11-connection-pool.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}"
```

---

## 5. テスト結果の確認と記録

### 5.1 curlスクリプトの結果

スクリプトの出力をそのまま試験項目書に転記できます。

```
========================================
テストID: ST01-IT2-PT-1
URL: http://prooflink-alb-xxx/api/test-groups/1
メソッド: POST
計測回数: 5
判定基準: 3000ms以内
========================================
  計測1回目: 2450ms (HTTP 200)
  計測2回目: 2380ms (HTTP 200)
  計測3回目: 2510ms (HTTP 200)
  計測4回目: 2320ms (HTTP 200)
  計測5回目: 2490ms (HTTP 200)
----------------------------------------
平均: 2430ms
各回: 2450 2380 2510 2320 2490
判定: OK (2430ms <= 3000ms)
========================================
```

### 5.2 k6の結果の読み方

k6の実行結果には以下の主要メトリクスが表示されます。

```
  scenarios: (100.00%) 1 scenario, 10 max VUs, 1m30s max duration
           ✓ status is 200

     checks.........................: 100.00% ✓ 10  ✗ 0
     http_req_duration..............: avg=1.23s  min=980ms  med=1.15s  max=2.1s  p(90)=1.8s  p(95)=1.95s
     http_req_failed................: 0.00%   ✓ 0   ✗ 10
     http_reqs......................: 10      1.5/s
     vus............................: 10      min=10 max=10
```

| メトリクス | 意味 | 確認対象テスト |
|-----------|------|---------------|
| `http_req_duration` avg | 平均レスポンスタイム | 全テスト |
| `http_req_duration` p(95) | 95パーセンタイル | LT-1～LT-3, LT-6～LT-8 |
| `http_req_failed` | エラーレート | 全テスト |
| `checks` | アサーション結果 | 全テスト |

### 5.3 k6結果のJSON出力

詳細な結果をJSONファイルに保存する場合:

```bash
k6 run --out json=result.json tests/load/lt-1-2-3-concurrent-list.js \
  -e BASE_URL="${BASE_URL}" \
  -e LOGIN_EMAIL="${LOGIN_EMAIL}" \
  -e LOGIN_PASSWORD="${LOGIN_PASSWORD}" \
  -e VUS=10
```

### 5.4 試験項目書への記録

| 記録項目 | curl結果の取得元 | k6結果の取得元 |
|---------|-----------------|---------------|
| 平均レスポンスタイム | スクリプト出力の「平均」 | `http_req_duration` avg |
| 95パーセンタイル | - | `http_req_duration` p(95) |
| 最大レスポンスタイム | 各回の最大値 | `http_req_duration` max |
| エラーレート | HTTPステータス確認 | `http_req_failed` |
| 判定（OK/NG） | スクリプト出力の「判定」 | thresholds の pass/fail |

---

## 6. CloudWatchによるサーバー側監視

負荷テスト（LT-7～LT-11）の実行中は、AWSマネジメントコンソールでサーバー側のメトリクスを並行して監視してください。

### 6.1 ECSメトリクス

AWSコンソール → CloudWatch → メトリクス → ECS → クラスター名を選択

| メトリクス | 確認内容 | 異常の目安 |
|-----------|---------|-----------|
| CPUUtilization | CPU使用率 | 80%超が継続 |
| MemoryUtilization | メモリ使用率 | 80%超が継続（メモリリークの兆候） |
| RunningTaskCount | 稼働タスク数 | 設定値より減少（タスク再起動の兆候） |

### 6.2 RDSメトリクス

AWSコンソール → RDS → データベース → 「モニタリング」タブ

| メトリクス | 確認内容 | 異常の目安 |
|-----------|---------|-----------|
| CPUUtilization | CPU使用率 | LT-8: 80%を超えないこと |
| DatabaseConnections | 接続数 | Prismaの接続プール上限に近い場合注意 |
| FreeableMemory | 利用可能メモリ | 急激な減少 |

### 6.3 ALBメトリクス

AWSコンソール → EC2 → ロードバランサー → 「モニタリング」タブ

| メトリクス | 確認内容 | 異常の目安 |
|-----------|---------|-----------|
| HTTPCode_Target_5XX_Count | 5xxエラー数 | LT-9: 0であること |
| HealthyHostCount | 正常ホスト数 | LT-9: 減少しないこと |

---

## 7. トラブルシューティング

### 7.1 WAFによるブロック（HTTP 403）

テスト実施端末のIPがWAF許可リストに未登録の場合、全リクエストが403で失敗します。

**解決策:**
1. AWSコンソール → WAF & Shield → IP sets → `prooflink-allowed-ips`
2. テスト実施端末のグローバルIPをCIDR形式（例: `203.0.113.10/32`）で追加

### 7.2 curlで認証が通らない

**確認手順:**

```bash
# CSRFトークンが取得できているか確認
curl -s "${BASE_URL}/api/auth/csrf"

# Cookieファイルの中身を確認
cat "$COOKIE_FILE"
```

- CSRFレスポンスが返ってこない場合、URLが正しいか確認
- `next-auth.session-token` CookieがセットされていればログインOK

### 7.3 k6で認証Cookie が引き継がれない

k6はVUごとにCookie Jarが独立しています。各VUの最初のイテレーション（`__ITER === 0`）でログインしてください。

### 7.4 k6のDNS解決エラー

```
WARN[0001] Request Failed error="Get ...: dial tcp: lookup ... on ...: no such host"
```

**解決策:** `BASE_URL` が正しいか確認。ALBのDNS名に余分な空白やスラッシュが含まれていないか確認。

### 7.5 大量VUでのリソース不足

50VU以上のテスト（LT-3, LT-9, LT-11）でテスト実施端末のリソースが不足する場合:

```bash
# ファイルディスクリプタの上限を引き上げ
ulimit -n 65535
```

---

**作成日**: 2026-02-26
**対象システム**: ProofLink
**対象試験項目書**: IT2_総合試験項目書_性能テスト, IT2_総合試験項目書_負荷テスト
