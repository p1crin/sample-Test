# Prisma マイグレーション運用ガイド

## 目次

1. [概要](#概要)
2. [マイグレーションの基本](#マイグレーションの基本)
3. [スキーマ変更の手順](#スキーマ変更の手順)
4. [よくあるスキーマ変更パターン](#よくあるスキーマ変更パターン)
5. [マイグレーション実行](#マイグレーション実行)
6. [トラブルシューティング](#トラブルシューティング)
7. [ベストプラクティス](#ベストプラクティス)
8. [本番環境での実行](#本番環境での実行)

---

## 概要

### Prisma マイグレーションとは

Prisma マイグレーションは、データベーススキーマの変更を管理・追跡するための仕組みです。テーブル定義を変更した際に、その変更履歴を記録し、別環境への適用や、トラブル時のロールバックを可能にします。

### 重要な概念

- **schema.prisma**: スキーマの現在の「あるべき状態」を定義
- **migration**: スキーマの変更履歴（SQL ファイルとして保存）
- **prisma/migrations/**: マイグレーションファイルの保存ディレクトリ
- **_prisma_migrations テーブル**: 実行済みマイグレーションの記録

---

## マイグレーションの基本

### マイグレーションの流れ

```
1. schema.prisma を編集
   ↓
2. マイグレーションファイルを生成
   ↓
3. データベースに適用
   ↓
4. Prisma Client を再生成
```

### よくある間違い

❌ **やってはいけないこと:**
- SQL を直接実行してテーブルを変更
- マイグレーションをスキップして schema.prisma だけを修正
- git 管理外でマイグレーションファイルを削除
- 本番環境で手動の schema.prisma 編集

✅ **正しい方法:**
- 必ず schema.prisma から始める
- Prisma のコマンドでマイグレーションを生成
- マイグレーションファイルを git 管理する
- 環境が異なってもマイグレーション手順を統一

---

## スキーマ変更の手順

### ステップ1: schema.prisma を編集

`prisma/schema.prisma` を編集して、新しいテーブル定義を記述します。

**例: ユーザーテーブルに「department」列を追加**

```prisma
model mt_users {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  password     String
  name         String?
  user_role    Int      @default(2)
  department   String   @default("")  // ← 追加する列
  company      String   @default("")
  is_deleted   Boolean  @default(false)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  created_by   String?
  updated_by   String?

  @@map("mt_users")
}
```

**編集時の注意点:**

- 新しい列には `@default()` または `?` (オプション) を指定する
- 既存データがある場合、すべてのレコードに適用可能なデフォルト値を指定
- テーブル名を変更する場合は `@@map()` を使用

### ステップ2: マイグレーションファイルを生成

```bash
npx prisma migrate dev --name add_department_to_users
```

**コマンドの説明:**

- `npx prisma migrate dev`: 開発環境でマイグレーション実行 + ファイル生成
- `--name <migration_name>`: マイグレーション名（スネークケースで記述）

**成功するとこうなります:**

```
✔ Created migration from schema changes

✔ Applied the following migration(s):
  migrations/20250102120000_add_department_to_users/

✔ Prisma Client has been updated
```

### ステップ3: マイグレーションファイルを確認

生成されたマイグレーションファイルを確認してください。

```bash
cat prisma/migrations/20250102120000_add_department_to_users/migration.sql
```

**例の出力:**

```sql
-- AddColumnToMtUsers
ALTER TABLE "mt_users" ADD COLUMN "department" VARCHAR(255) NOT NULL DEFAULT '';
```

### ステップ4: 動作確認

開発環境で API を起動して、アプリケーションが正常に動作することを確認します。

```bash
npm run dev
```

### ステップ5: git にコミット

マイグレーションファイルと schema.prisma を git に追加してコミットします。

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "Add department column to mt_users table"
```

---

## よくあるスキーマ変更パターン

### パターン1: 新しい列を追加

```prisma
// Before
model mt_users {
  id       Int     @id @default(autoincrement())
  email    String  @unique
  password String
}

// After
model mt_users {
  id           Int     @id @default(autoincrement())
  email        String  @unique
  password     String
  phone_number String?  // ← 追加（オプション）
  department   String  @default("")  // ← 追加（デフォルト値あり）
}
```

**注意点:**
- 既存データがあり、必須の列（非NULL）を追加する場合は `@default()` を指定
- オプション列（NULL 許容）の場合は `?` で十分

### パターン2: 列の型を変更

```prisma
// Before
model tt_test_groups {
  test_startdate String?
  test_enddate   String?
}

// After
model tt_test_groups {
  test_startdate DateTime?  // ← String から DateTime に変更
  test_enddate   DateTime?
}
```

**注意点:**
- 既存データの型変換が必要な場合、Prisma は自動変換しません
- マイグレーションファイルを手動編集してデータ変換ロジックを追加する必要があります

### パターン3: 列を削除

```prisma
// Before
model mt_users {
  id       Int    @id @default(autoincrement())
  email    String @unique
  old_field String  // ← 削除する列
}

// After
model mt_users {
  id    Int    @id @default(autoincrement())
  email String @unique
}
```

**注意点:**
- 削除前にデータ損失がないか確認が必須
- バックアップを取得してから実行

### パターン4: リレーションを追加

```prisma
// Before
model tt_test_groups {
  id   Int    @id @default(autoincrement())
  name String
}

model mt_tags {
  id   Int    @id @default(autoincrement())
  name String
}

// After
model tt_test_groups {
  id   Int    @id @default(autoincrement())
  name String
  tags tt_test_group_tags[]  // ← リレーション追加
}

model mt_tags {
  id   Int    @id @default(autoincrement())
  name String
  test_groups tt_test_group_tags[]  // ← リレーション追加
}

// 中間テーブル
model tt_test_group_tags {
  test_group_id Int
  tag_id        Int
  test_group    tt_test_groups @relation(fields: [test_group_id], references: [id])
  tag           mt_tags        @relation(fields: [tag_id], references: [id])

  @@id([test_group_id, tag_id])
}
```

**注意点:**
- 中間テーブルを作成する場合は `@@id([fieldA, fieldB])` で複合主キーを指定
- 外部キー制約を適切に設定

### パターン5: 制約を追加

```prisma
// Before
model mt_users {
  id    Int     @id @default(autoincrement())
  email String
}

// After
model mt_users {
  id    Int     @id @default(autoincrement())
  email String  @unique  // ← ユニーク制約を追加
}
```

**注意点:**
- ユニーク制約を追加する場合、既存データに重複がないことを確認

---

## マイグレーション実行

### 開発環境での実行

```bash
# マイグレーションを生成して実行（開発環境用）
npx prisma migrate dev --name <migration_name>

# 既存のマイグレーションを実行（名前指定なし）
npx prisma migrate dev
```

### ステージング・本番環境での実行

```bash
# マイグレーションを実行（ファイル生成なし）
npx prisma migrate deploy
```

**`migrate deploy` の特徴:**
- マイグレーションファイルが既に存在することが前提
- 新しいファイルを生成しない（git 管理のみ）
- CI/CD パイプラインに組み込むのに適している

### マイグレーション実行状況の確認

```bash
# 実行済みマイグレーションを表示
npx prisma migrate status
```

**出力例:**

```
Following migrations have not yet been applied:
  migrations/20250102120000_add_department_to_users
```

---

## トラブルシューティング

### エラー1: "Database reset is not allowed on a shadow database"

**原因**: 複数のマイグレーションが失敗して矛盾した状態

**対応:**

```bash
# 1. マイグレーションを一旦リセット（開発環境のみ）
npx prisma migrate reset

# 2. 全テーブルが再作成され、最新スキーマが適用される
# 確認メッセージに「y」で応答
```

⚠️ **注意**: `prisma migrate reset` は開発環境でのみ使用してください。本番環境では使用しないでください。

### エラー2: "Migration name is required"

**原因**: マイグレーション名を指定していない

**対応:**

```bash
# 正: マイグレーション名を指定
npx prisma migrate dev --name add_new_column

# 誤: マイグレーション名なし
npx prisma migrate dev
```

### エラー3: "Failed to apply migration"

**原因**: スキーマが矛盾しているか、生成された SQL に問題がある

**対応:**

1. 生成されたマイグレーションファイルを確認
   ```bash
   cat prisma/migrations/[latest_migration]/migration.sql
   ```

2. 問題があれば手動で編集
   ```bash
   # マイグレーションフォルダをエディタで開く
   code prisma/migrations/
   ```

3. 修正後に再実行
   ```bash
   npx prisma migrate deploy
   ```

### エラー4: "Foreign key constraint violation"

**原因**: リレーション設定に矛盾がある、または参照先レコードが削除されている

**対応:**

1. 制約チェックを一時的に無効化
   ```sql
   ALTER TABLE your_table DISABLE TRIGGER ALL;
   -- マイグレーション実行
   ALTER TABLE your_table ENABLE TRIGGER ALL;
   ```

2. マイグレーションファイルにこれを追加
   ```sql
   -- In migration.sql
   ALTER TABLE "tt_test_group_tags" DISABLE TRIGGER ALL;
   ALTER TABLE "tt_test_group_tags" ADD COLUMN "new_column" VARCHAR(255);
   ALTER TABLE "tt_test_group_tags" ENABLE TRIGGER ALL;
   ```

### エラー5: "Column does not exist"

**原因**: マイグレーションが完全に適用されていない

**対応:**

```bash
# 1. 現在の状況を確認
npx prisma migrate status

# 2. 失敗したマイグレーション以降のすべてを確認
# 3. 開発環境の場合はリセット
npx prisma migrate reset

# 4. 本番環境の場合は手動で調査
psql -h localhost -U user -d database -c "\d table_name"
```

---

## ベストプラクティス

### 1. マイグレーション名は明確に

```bash
# ✅ 良い例
npx prisma migrate dev --name add_department_to_users
npx prisma migrate dev --name create_test_group_tags_table
npx prisma migrate dev --name change_user_email_unique

# ❌ 悪い例
npx prisma migrate dev --name update
npx prisma migrate dev --name fix
npx prisma migrate dev --name schema_changes
```

### 2. 小さなマイグレーションに分ける

```bash
# ❌ 避ける: 複数の変更を1つのマイグレーションに
# - テーブルA に列を追加
# - テーブルB に列を追加
# - リレーション設定変更

# ✅ 推奨: 1つの変更 = 1つのマイグレーション
npx prisma migrate dev --name add_phone_to_users
npx prisma migrate dev --name add_status_to_test_groups
npx prisma migrate dev --name add_user_test_group_relation
```

### 3. スキーマ変更前にバックアップ

本番環境では必ずバックアップを取得してからマイグレーションを実行します。

```bash
# PostgreSQL のバックアップ取得
pg_dump -h localhost -U user -d database > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 4. マイグレーションファイルは git 管理

```bash
# マイグレーションファイルを絶対に .gitignore に入れない
git add prisma/migrations/
git commit -m "Add migration: add_department_to_users"
```

### 5. 本番環境への適用は自動化

```bash
# CI/CD パイプラインに以下を含める
npx prisma migrate deploy
```

### 6. データマイグレーションが必要な場合

型変更などでデータ変換が必要な場合、マイグレーション SQL を手動編集します。

**例: String から DateTime への変換**

```sql
-- migration.sql

-- 1. 新しい列を作成
ALTER TABLE "tt_test_groups" ADD COLUMN "test_startdate_new" TIMESTAMP;

-- 2. 既存データを変換
UPDATE "tt_test_groups"
SET "test_startdate_new" = TO_TIMESTAMP("test_startdate", 'YYYY-MM-DD')
WHERE "test_startdate" IS NOT NULL;

-- 3. 古い列を削除
ALTER TABLE "tt_test_groups" DROP COLUMN "test_startdate";

-- 4. 新しい列を名前変更
ALTER TABLE "tt_test_groups" RENAME COLUMN "test_startdate_new" TO "test_startdate";
```

---

## 本番環境での実行

### デプロイメント前の確認リスト

- [ ] 開発環境で十分なテストを実施
- [ ] ステージング環境でマイグレーションを実行
- [ ] データベースのバックアップを取得
- [ ] ロールバック計画を立てている
- [ ] チームメンバーに通知済み
- [ ] マイグレーション実行時の想定ダウンタイムを把握

### 本番環境での実行手順

```bash
# 1. バックアップ取得
pg_dump -h production_host -U user -d database > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 最新コードを取得
git pull origin main

# 3. 依存パッケージを更新
npm install

# 4. マイグレーションを実行
npx prisma migrate deploy

# 5. ビルド・再デプロイ
npm run build
npm start
```

### トラブル時のロールバック

Prisma には自動ロールバック機能がないため、SQL でロールバックします。

```bash
# 1. バックアップから復元
psql -h localhost -U user -d database < backup_20250102_120000.sql

# 2. または マイグレーション履歴テーブルから確認して手動ロールバック
SELECT * FROM "_prisma_migrations" ORDER BY "finished_at" DESC LIMIT 5;

# 3. 最後のマイグレーション前の状態に戻すための SQL を実行
```

---

## チェックリスト: スキーマ変更時にすべきこと

### 開発時

- [ ] schema.prisma を編集
- [ ] `npx prisma migrate dev --name <name>` を実行
- [ ] 生成されたマイグレーション SQL を確認
- [ ] 開発環境で API 動作確認
- [ ] Prisma Studio で データ確認: `npx prisma studio`
- [ ] git にコミット

### リリース前

- [ ] ステージング環境でマイグレーション実行
- [ ] ステージング環境で API テスト
- [ ] データベースバックアップ作成
- [ ] ロールバック手順を文書化

### リリース時

- [ ] チームに通知
- [ ] バックアップを取得
- [ ] `npx prisma migrate deploy` 実行
- [ ] ビルド・再デプロイ
- [ ] 本番環境で動作確認
- [ ] ログを監視

---

## 参考資料

- [Prisma Migrate 公式ドキュメント](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/overview)
- [Prisma Schema リファレンス](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
- [PostgreSQL データ型](https://www.postgresql.org/docs/current/datatype.html)

---

**最終更新日**: 2025年12月2日
**バージョン**: 1.0
