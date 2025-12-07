# テストグループ編集機能：新規参画者向けガイド
## README: Test Group Edit Feature Guide for New Team Members

このドキュメントは、テストグループ編集機能の実装に取り組む新規参画者のための案内ドキュメントです。

---

## 📚 ドキュメント構成

本ガイドは、以下の 3 つのドキュメントで構成されています。

### 1. 📖 `LEARNING_GUIDE_TEST_GROUP_EDIT.md` - メインのラーニングガイド

**対象**: 体系的に学習したい方

このドキュメントには以下の内容が含まれます：
- ✅ システム全体像とアーキテクチャ
- ✅ 実装順序と学習フロー（フェーズ 1-4）
- ✅ 詳細な実装説明（コード例付き）
- ✅ 実装メモと注意点
- ✅ 検証ステップ
- ✅ トラブルシューティング
- ✅ 学習用チェックリスト

**推奨**: 最初に このドキュメントを読んでから実装を開始してください

---

### 2. 💻 `IMPLEMENTATION_TEMPLATES.md` - 実装テンプレート集

**対象**: 実装を開始する際に使用

このドキュメントには以下のテンプレートが含まれます：
- ✅ API エンドポイント（PUT/DELETE）
- ✅ Zod バリデーションスキーマ
- ✅ Container コンポーネント
- ✅ Form UI コンポーネント
- ✅ ページコンポーネント
- ✅ カスタマイズ例

**推奨**: 各コンポーネント実装時に、対応するテンプレートをコピペして調整してください

---

### 3. ✅ `IMPLEMENTATION_CHECKLIST.md` - 実装チェックリスト

**対象**: 実装進捗を管理したい方

このドキュメントには以下が含まれます：
- ✅ 全体進捗トラッキング
- ✅ フェーズごとの詳細チェックリスト
- ✅ テストシナリオ
- ✅ 手動テストチェック
- ✅ 学習完了確認項目

**推奨**: このチェックリストをコピーして、実装しながら各項目にチェック を入れてください

---

## 🎯 実装の流れ（クイックスタート）

### ステップ 1: 学習（1-2 日）

```
1. このドキュメント（README）を読む
2. LEARNING_GUIDE_TEST_GROUP_EDIT.md の「学習前提知識」セクションを読む
3. 「システム全体像」セクションで全体を理解
4. 「実装順序と学習フロー」の フェーズ 1 を実施
```

**チェック**: テストグループ作成（POST）との違いを説明できるようになったか？

### ステップ 2: バックエンド実装（2-3 日）

```
1. IMPLEMENTATION_TEMPLATES.md の「1. API テンプレート」をコピー
2. LEARNING_GUIDE_TEST_GROUP_EDIT.md の「詳細実装ガイド」を参照
3. API エンドポイント（PUT/DELETE）を実装
4. IMPLEMENTATION_CHECKLIST.md の「フェーズ 2」でチェック
```

**参考ファイル**: `/app/api/test-groups/[groupId]/route.ts`

**チェック**: curl で API をテストできるか？

### ステップ 3: フロントエンド実装（2-3 日）

```
1. IMPLEMENTATION_TEMPLATES.md の「3-5. コンポーネントテンプレート」をコピー
2. LEARNING_GUIDE_TEST_GROUP_EDIT.md の「フロントエンド実装」を参照
3. 各コンポーネントを実装
4. IMPLEMENTATION_CHECKLIST.md の「フェーズ 3」でチェック
```

**参考ファイル**:
- `/app/(secure)/testGroup/regist/` - テストグループ作成の参考実装
- `/app/(secure)/testGroup/[groupId]/edit/` - 実装箇所

**チェック**: ブラウザで編集フォームが表示されるか？

### ステップ 4: テストと検証（1 日）

```
1. IMPLEMENTATION_CHECKLIST.md の「フェーズ 4」を実施
2. テストシナリオをすべて実行
3. 手動テストをすべて実行
4. ログが正しく出力されているか確認
```

**チェック**: すべてのテストシナリオが成功したか？

---

## 📋 学習リソースマップ

各トピックについて、どこを参照すべきかを示します：

| トピック | 参照先 |
|---------|--------|
| **システム全体像** | LEARNING_GUIDE §システム全体像 |
| **作成との違い** | LEARNING_GUIDE §作成 vs 編集：主な違い |
| **API 実装** | LEARNING_GUIDE §詳細実装ガイド・API テンプレート, IMPLEMENTATION_TEMPLATES §1 |
| **フロントエンド実装** | LEARNING_GUIDE §詳細実装ガイド・フロントエンド, IMPLEMENTATION_TEMPLATES §3-5 |
| **バリデーション** | LEARNING_GUIDE §バリデーションスキーマテンプレート, IMPLEMENTATION_TEMPLATES §2 |
| **認証・認可** | LEARNING_GUIDE §認証・認可の理解 |
| **ログ出力** | LEARNING_GUIDE §ログ出力の適切な分類 |
| **エラーハンドリング** | LEARNING_GUIDE §トラブルシューティング |
| **テスト方法** | LEARNING_GUIDE §検証ステップ, IMPLEMENTATION_CHECKLIST §フェーズ 4 |
| **進捗管理** | IMPLEMENTATION_CHECKLIST |

---

## 🚀 開始方法

### 推奨される読む順序

1. **このドキュメント**（今ここ！）- 5 分
2. **LEARNING_GUIDE_TEST_GROUP_EDIT.md の最初のセクション** - 30 分
   - 学習前提知識
   - システム全体像
3. **既存コードの確認** - 1 時間
   - テストグループ作成機能を読む
   - 既存の API を読む
4. **LEARNING_GUIDE のフェーズ 1 を実施** - 1-2 日
5. **バックエンド実装開始** - 参照: IMPLEMENTATION_TEMPLATES §1

---

## 💡 重要なポイント

実装を始める前に、以下のポイントを理解してください：

### ⚠️ 1. タグの形式が異なる

**作成時**: `{ tag_name: "Design", test_role: 0 }`
**編集時**: `{ tag_id: 1, test_role: 0 }`

フロントエンドでタグ名を tag_id に変換する必要があります。

参照: LEARNING_GUIDE §タグの形式が異なる

### ⚠️ 2. 権限要件が異なる

**作成**: Admin / Test Manager
**編集**: Creator のみ（管理者除く）

参照: LEARNING_GUIDE §権限チェックは異なる

### ⚠️ 3. バリデーションレベルが異なる

**作成**: すべてのフィールドが必須
**編集**: OEM と model のみ必須

参照: LEARNING_GUIDE §バリデーションレベルが異なる

### ⚠️ 4. HTTP メソッドが異なる

**作成**: POST → 201 Created
**編集**: PUT → 200 OK

参照: LEARNING_GUIDE §API 実装：PUT /api/test-groups/[groupId]

---

## 📞 質問やサポート

実装中に不明な点がある場合：

1. **このガイドセットを検索**
   - LEARNING_GUIDE: Ctrl+F で検索
   - IMPLEMENTATION_TEMPLATES: テンプレートをコピペ
   - IMPLEMENTATION_CHECKLIST: チェック項目を確認

2. **既存実装を参照**
   - テストグループ作成: `/app/(secure)/testGroup/regist/`
   - API エンドポイント: `/app/api/test-groups/route.ts`

3. **チームメンバーに相談**
   - 実装内容について
   - ビジネスロジックについて

4. **ブラウザコンソールを確認**
   - ログ出力: F12 → Console
   - ネットワーク: F12 → Network

---

## ✅ 実装完了の目安

以下がすべて達成できたら、実装は完了です：

- [ ] システム全体像を説明できる
- [ ] テストグループ作成との違いを説明できる
- [ ] API エンドポイント（PUT/DELETE）が実装されている
- [ ] フロントエンドフォームが実装されている
- [ ] すべてのテストシナリオが成功している
- [ ] ログが正しく出力されている
- [ ] セキュリティチェックが完了している

---

## 🎓 実装後の学習

実装完了後は、以下を学習することをお勧めします：

1. **テスト駆動開発（TDD）**
   - ユニットテストの実装
   - E2E テストの実装

2. **パフォーマンス最適化**
   - クエリ最適化
   - キャッシング戦略
   - バンドルサイズ削減

3. **モニタリング・運用**
   - エラートラッキング
   - パフォーマンス監視
   - ユーザー体験の計測

4. **セキュリティ**
   - OWASP Top 10
   - 認可パターン
   - 監査ログ

参照: LEARNING_GUIDE §次のステップ

---

## 📁 関連ファイル一覧

実装に関連するファイル：

```
バックエンド API:
  /app/api/test-groups/
    ├── route.ts              ← GET (一覧), POST (作成)
    └── [groupId]/
        └── route.ts          ← GET (詳細), PUT (編集), DELETE (削除) ★実装対象

フロントエンド（参考実装）:
  /app/(secure)/testGroup/
    ├── regist/               ← 作成（参考）
    │   └── _components/
    │       ├── TestGroupRegistrantion.tsx
    │       └── schemas/testGroup-regist-schema.ts
    └── [groupId]/
        └── edit/             ← 編集（実装対象）
            └── _components/
                ├── TestGroupEditFormContainer.tsx
                ├── TestGroupEditForm.tsx
                └── schemas/testGroup-edit-schema.ts

認証・認可:
  /app/lib/auth.ts           ← 認証・認可関数

ユーティリティ:
  /utils/
    ├── database-logger.ts    ← ログ出力
    ├── server-logger.ts
    └── client-logger.ts

型定義:
  /types/
    ├── database/index.ts
    └── /app/(secure)/_components/types/testGroup-list-row.ts

データベーススキーマ:
  /prisma/schema.prisma       ← Prisma スキーマ
```

---

## 🔗 関連ドキュメント

- **テストグループ作成ガイド**: `LEARNING_GUIDE_TEST_GROUP_CREATION.md`（存在する場合）
- **API 設計ガイド**: プロジェクト内の API ドキュメント
- **認証・認可ガイド**: プロジェクト内のセキュリティドキュメント
- **ログ出力ガイド**: 前回のロギングシステム改善で作成されたドキュメント

---

## 📊 推奨スケジュール

新規参画者が実装する際の推奨スケジュール：

| 期間 | タスク | 目安時間 |
|------|--------|---------|
| **Day 1-2** | 学習（ガイド読込 + 既存コード確認） | 8 時間 |
| **Day 3-5** | バックエンド実装（API エンドポイント） | 12 時間 |
| **Day 6-7** | フロントエンド実装（コンポーネント） | 12 時間 |
| **Day 8** | テスト・検証・修正 | 8 時間 |
| **合計** | | **40 時間（1 週間程度）** |

実装内容や個人差により、このスケジュールは変わる可能性があります。

---

## 🎉 最後に

このガイドセットは、以下の目的で作成されました：

- 新規参画者が効率的に学習できるようにすること
- 実装漏れを防ぐこと
- 品質を保証すること
- チーム内のナレッジを蓄積すること

**実装を開始する際は、焦らず、一つのステップずつ進めてください。**
各フェーズを完了するたびに、IMPLEMENTATION_CHECKLIST でチェックして、
進捗を確認することをお勧めします。

わからないことは、このガイドセットを検索するか、既存実装を参照するか、
チームメンバーに相談してください。

---

## 📝 フィードバック

このガイドセットを使用して実装を進める際に、
改善点や追加すべき内容があれば、チームと共有してください。

ガイドの精度を高めることで、次の新規参画者の学習がさらに効率的になります。

---

**このドキュメントで実装を開始できます！**

**Good Luck! 🚀**

---

**作成日**: 2025-12-07
**ドキュメントセット構成**:
1. README_TEST_GROUP_EDIT_GUIDE.md（このファイル）
2. LEARNING_GUIDE_TEST_GROUP_EDIT.md（詳細ガイド）
3. IMPLEMENTATION_TEMPLATES.md（コードテンプレート）
4. IMPLEMENTATION_CHECKLIST.md（進捗チェックリスト）
