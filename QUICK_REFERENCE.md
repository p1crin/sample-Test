# テストグループ編集機能：クイックリファレンス
## Quick Reference Card

このドキュメントは、実装中に素早く情報を参照できるようにデザインされています。
実装時に何度も参照することを想定しています。

---

## 🎯 作成 vs 編集：比較表

| 項目 | 作成 (POST) | 編集 (PUT) |
|------|-----------|----------|
| **HTTP メソッド** | POST | PUT |
| **エンドポイント** | `/api/test-groups` | `/api/test-groups/{id}` |
| **ステータスコード** | 201 | 200 |
| **必須フィールド** | oem, model, event, variation, destination, specs, test_startdate, test_enddate, ng_plan_count | oem, model のみ |
| **オプショナル** | なし | その他すべて |
| **タグフォーマット** | `{ tag_name, test_role }` | `{ tag_id, test_role }` ⚠️ |
| **権限要件** | Admin / Test Manager | Creator のみ |
| **応答データ** | 作成されたレコード | 更新されたレコード |
| **フロント UI** | 入力フォーム | プリロードフォーム |

---

## 📁 ファイル構造

```
実装対象:
  /app/api/test-groups/[groupId]/route.ts
    ├── PUT  ← 編集機能
    └── DELETE ← 削除機能（ソフトデリート）

  /app/(secure)/testGroup/[groupId]/edit/
    ├── page.tsx
    └── _components/
        ├── TestGroupEditFormContainer.tsx
        ├── TestGroupEditForm.tsx
        └── schemas/
            └── testGroup-edit-schema.ts

参考実装:
  /app/(secure)/testGroup/regist/
    └── 作成機能（参考）
```

---

## 🔄 データフロー図

### 編集フロー全体

```
ユーザー入力
    ↓
[編集ページを開く]
    ↓
GET /api/test-groups/{id}
    ↓
既存データをプリロード
    ↓
ユーザーが値を変更
    ↓
[更新ボタン]
    ↓
Zod バリデーション（クライアント）
    ↓
タグ名を tag_id に変換 ⚠️
    ↓
PUT /api/test-groups/{id}
    ↓
[サーバー]
    ├─ 認証確認
    ├─ 権限確認（creator のみ）
    ├─ バリデーション
    ├─ DB トランザクション
    │  ├─ tt_test_groups を更新
    │  ├─ tt_test_group_tags を削除
    │  └─ 新しいタグを作成
    ├─ ログ出力
    └─ レスポンス
    ↓
成功/エラー処理
    ↓
UI 更新 or リダイレクト
```

---

## 💻 API 仕様

### PUT /api/test-groups/{groupId}

**リクエスト:**
```typescript
{
  oem: string              // ✅ 必須
  model: string            // ✅ 必須
  event?: string           // オプション
  variation?: string       // オプション
  destination?: string     // オプション
  specs?: string          // オプション
  test_startdate?: string  // オプション (ISO 形式)
  test_enddate?: string    // オプション (ISO 形式)
  ng_plan_count?: number   // オプション (0-9999)
  tags?: [
    { tag_id: number, test_role: number },
    ...
  ]                       // オプション ⚠️ tag_id に注意！
}
```

**レスポンス（成功）:**
```typescript
{
  success: true,
  data: {
    id: number,
    oem: string,
    model: string,
    ...
  }
}
```

**ステータスコード:**
- 200: 成功
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー
- 500: サーバーエラー

---

## ⚙️ API 実装のステップ

```typescript
export async function PUT(req, { params }) {
  // 1️⃣ 認証確認
  const user = await requireAuth(req);

  // 2️⃣ パラメータ取得・検証
  const groupId = parseInt(params.groupId, 10);

  // 3️⃣ 権限確認
  const canModify = await canModifyTestGroup(user, groupId);

  // 4️⃣ リクエストボディ取得
  const body = await req.json();

  // 5️⃣ バリデーション
  if (!oem || !model) return 400;

  // 6️⃣ DB 更新（トランザクション）
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.tt_test_groups.update({...});
    await tx.tt_test_group_tags.deleteMany({...});
    await tx.tt_test_group_tags.createMany({...});
    return result;
  });

  // 7️⃣ ログ出力
  logAPIEndpoint({...});

  // 8️⃣ レスポンス
  return NextResponse.json({ success: true, data: updated });
}
```

---

## 🎨 フロントエンド実装のステップ

```typescript
'use client';

export default function Container({ groupId }) {
  // 1️⃣ 状態定義
  const [formData, setFormData] = useState({...});
  const [loading, setLoading] = useState(true);

  // 2️⃣ データ取得
  useEffect(() => {
    const data = await fetch(`/api/test-groups/${groupId}`);
    setFormData(data);
  }, [groupId]);

  // 3️⃣ 値の変更
  const handleChange = (field, value) => {
    setFormData(prev => ({...prev, [field]: value}));
  };

  // 4️⃣ フォーム送信
  const handleSubmit = async (e) => {
    e.preventDefault();

    // バリデーション
    const result = testGroupEditSchema.safeParse(formData);

    // タグ変換
    const tags = [...convertTagsToIds()];

    // API 呼び出し
    const response = await fetch(`/api/test-groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({...formData, tags})
    });
  };

  return loading ? <Loading /> : <Form {...props} />;
}
```

---

## 📋 バリデーションルール

| フィールド | 型 | 長さ | 範囲 | 必須 |
|-----------|-----|-------|------|------|
| oem | string | Max 255 | - | ✅ |
| model | string | Max 255 | - | ✅ |
| event | string | Max 255 | - | ❌ |
| variation | string | Max 255 | - | ❌ |
| destination | string | Max 255 | - | ❌ |
| specs | string | - | - | ❌ |
| test_startdate | date | - | <= enddate | ❌ |
| test_enddate | date | - | >= startdate | ❌ |
| ng_plan_count | number | - | 0-9999 | ❌ |
| designerTag | array | - | - | ❌ |
| executerTag | array | - | - | ❌ |
| viewerTag | array | - | - | ❌ |

---

## 📝 ログレベルの使い分け

| 状況 | レベル | 出力例 |
|------|--------|--------|
| **更新成功** | INFO | `{ method: 'PUT', statusCode: 200, executionTime: '123.45ms' }` |
| **バリデーション失敗** | WARN | `{ statusCode: 400, error: 'oem is required' }` |
| **権限なし** | WARN | `{ statusCode: 403, error: 'Permission denied' }` |
| **認証失敗** | WARN | `{ statusCode: 401, error: 'Unauthorized' }` |
| **サーバーエラー** | ERROR | `{ statusCode: 500, error: 'Database connection failed' }` |

---

## 🚨 よくあるミス

### ❌ ミス 1: タグの形式間違い
```typescript
// 間違い：作成時の形式を使う
const tags = formData.designerTag.map(name => ({
  tag_name: name,  // ❌ これは作成時の形式
  test_role: 0
}));

// 正解：編集時は tag_id を使う
const tags = formData.designerTag.map(name => ({
  tag_id: tags.find(t => t.name === name)?.id,  // ✅
  test_role: 0
}));
```

### ❌ ミス 2: 権限チェック忘れ
```typescript
// 間違い：権限チェックなし
const updated = await prisma.tt_test_groups.update({...});

// 正解：権限チェックをする
if (!canModifyTestGroup(user, groupId)) {
  return 403;
}
const updated = await prisma.tt_test_groups.update({...});
```

### ❌ ミス 3: トランザクションなし
```typescript
// 間違い：トランザクションなし（不整合の可能性）
await prisma.tt_test_groups.update({...});
await prisma.tt_test_group_tags.deleteMany({...});
await prisma.tt_test_group_tags.createMany({...});

// 正解：トランザクションで原子性保証
const updated = await prisma.$transaction(async (tx) => {
  const result = await tx.tt_test_groups.update({...});
  await tx.tt_test_group_tags.deleteMany({...});
  await tx.tt_test_group_tags.createMany({...});
  return result;
});
```

### ❌ ミス 4: ステータスコード間違い
```typescript
// 間違い：成功時に 201 を返す
return NextResponse.json({ success: true, data: updated }, { status: 201 });

// 正解：成功時は 200
return NextResponse.json({ success: true, data: updated }, { status: 200 });
```

### ❌ ミス 5: エラーハンドリング不足
```typescript
// 間違い：エラーログなし
if (!oem) return 400;

// 正解：ログを出力してからエラーレスポンス
if (!oem) {
  logAPIEndpoint({
    statusCode: 400,
    error: 'oem is required'
  });
  return NextResponse.json(...);
}
```

---

## 🧪 テストコマンド

### curl でテスト（API）

```bash
# 成功時
curl -X PUT http://localhost:3000/api/test-groups/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{
    "oem": "Updated OEM",
    "model": "Model X",
    "tags": [
      { "tag_id": 1, "test_role": 0 }
    ]
  }'

# バリデーションエラー
curl -X PUT http://localhost:3000/api/test-groups/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{"model": "X"}'  # oem なし

# 権限エラー（別ユーザーで実行）
curl -X PUT http://localhost:3000/api/test-groups/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=OTHER_USER_SESSION" \
  -d '{"oem": "X", "model": "Y"}'
```

### ブラウザでテスト（UI）

1. テストグループ一覧 → テストグループ選択
2. [編集] ボタンをクリック
3. フィールドを編集
4. [更新] をクリック
5. 成功メッセージを確認
6. F12 → Network で PUT リクエストを確認
7. F12 → Console でログを確認

---

## 📊 ファイルサイズ・処理時間の目安

| 項目 | 目安 | 注意点 |
|------|------|--------|
| API 応答時間 | 500ms 以下 | DB クエリが遅い場合は最適化 |
| フロントエンド初期ロード | 2 秒以下 | 大きなコンポーネントは分割 |
| UI 操作 (onChange) | 100ms 以下 | 不要な state 更新を削除 |
| リクエストサイズ | 10KB 以下 | JSON データを最小化 |

---

## 🔗 関連型定義

```typescript
// Prisma
model tt_test_groups {
  id              Int                  @id @default(autoincrement())
  oem             String?              @db.VarChar(255)
  model           String?              @db.VarChar(255)
  // ... その他フィールド
  tt_test_group_tags tt_test_group_tags[]
}

model tt_test_group_tags {
  test_group_id   Int
  tag_id          Int
  test_role       Int  // 0=Designer, 1=Executor, 2=Viewer
}

// TypeScript
interface TestGroupEditFormData {
  oem: string;
  model: string;
  event: string;
  variation: string;
  destination: string;
  specs: string;
  test_startdate: string;
  test_enddate: string;
  ngPlanCount: number;
  designerTag: string[];
  executerTag: string[];
  viewerTag: string[];
}

enum TestRole {
  DESIGNER = 0,
  EXECUTOR = 1,
  VIEWER = 2
}
```

---

## 📞 トラブルシューティング早見表

| エラー | 原因 | 解決策 |
|--------|------|--------|
| `403 Permission denied` | creator でない | 権限を確認 / 管理者で実行 |
| `400 validation error` | 必須フィールド不足 | oem, model を確認 |
| `Cannot find tag` | タグが見つからない | タグ名の綴りを確認 |
| `500 Internal error` | DB エラー | ログを確認 / Prisma Studio で確認 |
| `Undefined tag_id` | タグ名が一致しない | 大文字小文字を確認 |
| `TypeError: Cannot read property` | null/undefined アクセス | null チェックを追加 |

---

## 💡 実装チェックリスト（ミニ版）

### バックエンド
- [ ] PUT メソッド実装
- [ ] DELETE メソッド実装（ソフトデリート）
- [ ] 認証チェック
- [ ] 権限チェック
- [ ] バリデーション実装
- [ ] トランザクション処理
- [ ] ログ出力
- [ ] curl でテスト可能

### フロントエンド
- [ ] バリデーションスキーマ
- [ ] Container コンポーネント
- [ ] Form コンポーネント
- [ ] ページコンポーネント
- [ ] データプリロード
- [ ] タグ変換処理
- [ ] エラー表示
- [ ] ローディング表示

### テスト
- [ ] 正常系テスト
- [ ] バリデーションエラー
- [ ] 権限エラー
- [ ] 認証エラー
- [ ] タグ更新確認
- [ ] ログ出力確認

---

## 📚 詳細マニュアルへのリンク

| トピック | 参照先 |
|---------|--------|
| システム全体像 | LEARNING_GUIDE §システム全体像 |
| API 詳細実装 | LEARNING_GUIDE §詳細実装ガイド・API 実装 |
| フロントエンド詳細 | LEARNING_GUIDE §詳細実装ガイド・フロントエンド |
| コード テンプレート | IMPLEMENTATION_TEMPLATES |
| 詳細チェックリスト | IMPLEMENTATION_CHECKLIST |
| トラブルシューティング | LEARNING_GUIDE §トラブルシューティング |

---

**このクイックリファレンスを手元に置いて、実装を進めてください！**

実装時に何度も参照できるようにデザインされています。

---

**最終更新**: 2025-12-07
