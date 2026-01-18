# ローカル開発環境からのS3アクセス設定ガイド（ProofLink）

このドキュメントでは、Windows環境のローカル開発マシンからAWS S3にアクセスしてファイルアップロード機能をテストする方法を説明します。

## 目次

1. [概要](#概要)
2. [IAMユーザーの作成](#iamユーザーの作成)
3. [S3バケットの作成](#s3バケットの作成)
4. [ローカル環境の設定](#ローカル環境の設定)
5. [動作確認](#動作確認)
6. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### IAMユーザーとは

**IAMユーザー**は、ローカル開発環境のアプリケーション（Next.js）がAWSリソース（S3など）にアクセスするための認証情報を提供します。

```
┌─────────────────────────────────────────┐
│ あなた（開発者）                        │
│ ↓                                       │
│ AWS Management Console にログイン      │
│ （管理者アカウント）                    │
└─────────────────────────────────────────┘
        ↓ 作成する
┌─────────────────────────────────────────┐
│ IAMユーザー（開発用）                   │
│ - ユーザー名: prooflink-developer      │
│ - アクセスキー（文字列）を発行          │
│ - これをローカルの.env.localに記載      │
└─────────────────────────────────────────┘
        ↓ 使用する
┌─────────────────────────────────────────┐
│ ローカルのNext.jsアプリケーション       │
│ - .env.localから認証情報を読み込む      │
│ - S3にファイルをアップロード            │
└─────────────────────────────────────────┘
```

### 対象ファイル

このシステムでは、以下のファイルをS3にアップロードします：

- **ユーザーインポート用CSVファイル**: ユーザー一括登録
- **テストケース制御仕様書**: テスト設計書類
- **データフロー図**: テスト関連図表
- **テスト結果エビデンス**: スクリーンショット等の証跡ファイル

### 必要なツール

- **AWS Management Console**: ブラウザからAWSリソースを管理
- **AWS CLIは不要**: すべての作業をブラウザ（AWS Console）で実施可能
- **Windows環境**: PowerShellまたはコマンドプロンプトを使用

---

## IAMユーザーの作成

### ステップ1: AWS Management Consoleにログイン

1. ブラウザで [AWS Management Console](https://console.aws.amazon.com/) を開く
2. 管理者アカウントでログイン

### ステップ2: IAMサービスを開く

1. 画面上部の検索バーに「**IAM**」と入力
2. 検索結果から「**IAM**」を選択

![IAM Search](https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/images/console-search.png)

### ステップ3: ユーザーを作成

1. 左サイドメニューから「**ユーザー**」をクリック
2. 「**ユーザーを作成**」ボタンをクリック

### ステップ4: ユーザー名を入力

1. **ユーザー名**: `prooflink-developer`
2. 「**次へ**」をクリック

> **Note**: ユーザー名は任意ですが、用途が分かりやすい名前を推奨します

### ステップ5: 許可を設定

#### 5-1. ポリシーのアタッチ方法を選択

- 「**ポリシーを直接アタッチする**」を選択

#### 5-2. カスタムポリシーを作成（推奨 - 最小権限の原則）

より安全に設定するため、必要最小限の権限だけを持つカスタムポリシーを作成します。

1. 「**ポリシーを作成**」リンクをクリック（新しいタブが開きます）

2. 「**JSON**」タブを選択

3. 以下のJSON内容を貼り付け：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3AccessForDevelopment",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::prooflink-dev-*",
        "arn:aws:s3:::prooflink-dev-*/*"
      ]
    }
  ]
}
```

> **説明**:
> - `s3:PutObject`: ファイルをS3にアップロード
> - `s3:GetObject`: ファイルをS3からダウンロード
> - `s3:DeleteObject`: ファイルをS3から削除
> - `s3:ListBucket`: バケット内のファイル一覧を取得
> - `prooflink-dev-*`: `prooflink-dev-` で始まる名前のバケットのみアクセス可能

4. 「**次へ**」をクリック

5. **ポリシー名**: `ProofLink-Development-S3-Access`

6. **説明**: `ProofLinkローカル開発環境用のS3アクセス権限`

7. 「**ポリシーの作成**」をクリック

8. 元のタブ（ユーザー作成画面）に戻り、「更新」ボタンをクリック

9. 検索バーに `ProofLink-Development` と入力

10. 作成した `ProofLink-Development-S3-Access` ポリシーにチェック

#### 5-3. 簡易設定（開発初期のみ）

すぐに試したい場合は、以下の既存ポリシーを使用できます：

- 検索バーに「**S3**」と入力
- 「**AmazonS3FullAccess**」にチェック

> **⚠️ 注意**: `AmazonS3FullAccess` はすべてのS3バケットへのフルアクセス権限を持ちます。開発初期の動作確認用としてのみ使用し、本格的な開発ではカスタムポリシー（5-2）を使用してください。

11. 「**次へ**」をクリック

### ステップ6: 確認して作成

1. 設定内容を確認
2. 「**ユーザーの作成**」をクリック

---

## アクセスキーの作成

### ステップ1: ユーザーの詳細画面を開く

1. ユーザー一覧から `prooflink-developer` をクリック

### ステップ2: セキュリティ認証情報タブを開く

1. 「**セキュリティ認証情報**」タブをクリック

### ステップ3: アクセスキーを作成

1. 「**アクセスキーを作成**」ボタンをクリック

### ステップ4: ユースケースを選択

1. 「**ローカルコード**」を選択
2. 「**上記のレコメンデーションを理解し、アクセスキーを作成します**」にチェック
3. 「**次へ**」をクリック

### ステップ5: 説明タグを入力（オプション）

1. **説明タグ**: `prooflink-local-development`
2. 「**アクセスキーを作成**」をクリック

### ステップ6: アクセスキーを保存

⚠️ **重要**: この画面でしか「シークレットアクセスキー」は表示されません！

#### 方法1: 手動でコピー

1. 「**アクセスキー**」をコピーしてメモ帳に貼り付け
2. 「**シークレットアクセスキー**」の「表示」をクリックしてコピーしてメモ帳に貼り付け

#### 方法2: CSVファイルをダウンロード

1. 「**.csvファイルをダウンロード**」ボタンをクリック
2. ダウンロードした `credentials.csv` ファイルを安全な場所に保存

> **セキュリティ注意**:
> - アクセスキーとシークレットアクセスキーは**絶対にGitにコミットしない**
> - `.env.local` は `.gitignore` に含まれていることを確認
> - 他人と共有しない
> - 漏洩した場合はすぐに無効化して新しいキーを作成

3. 「**完了**」をクリック

---

## S3バケットの作成

### ステップ1: S3サービスを開く

1. AWS Management Consoleの検索バーに「**S3**」と入力
2. 検索結果から「**S3**」を選択

### ステップ2: 開発用バケットを作成

#### 2-1. インポート用バケット

1. 「**バケットを作成**」ボタンをクリック

2. **バケット名**: `prooflink-dev-imports`
   - バケット名は世界中で一意である必要があります
   - 既に使用されている場合は、`prooflink-dev-imports-20260117` のように日付を付加

3. **リージョン**: `アジアパシフィック（東京）ap-northeast-1`

4. **オブジェクト所有者**: 「**ACLを無効にする（推奨）**」を選択

5. **パブリックアクセスをブロック**: 「**パブリックアクセスをすべてブロック**」を**オンのまま**
   - これにより、インターネットから直接アクセスできなくなります（セキュリティ向上）

6. **バケットのバージョニング**: 無効（デフォルト）

7. **デフォルト暗号化**:
   - 「**サーバー側の暗号化**」を有効化（推奨）
   - 暗号化タイプ: 「**Amazon S3 マネージドキー（SSE-S3）**」

8. 「**バケットを作成**」をクリック

#### 2-2. エビデンスファイル用バケット（オプション）

テスト結果のエビデンスファイル（スクリーンショット等）用に別バケットを作成する場合：

1. 「**バケットを作成**」ボタンをクリック
2. **バケット名**: `prooflink-dev-evidence`
3. 他の設定は上記と同じ
4. 「**バケットを作成**」をクリック

### ステップ3: バケット作成の確認

1. S3バケット一覧に以下が表示されることを確認：
   - `prooflink-dev-imports`
   - `prooflink-dev-evidence`（作成した場合）

---

## ローカル環境の設定

### ステップ1: .env.localファイルの編集

プロジェクトのルートディレクトリにある `.env.local` ファイルを開きます。

#### Windowsでの開き方

**方法1: VS Code（推奨）**
```powershell
# PowerShellで実行
cd C:\path\to\your\prooflink-project
code .env.local
```

**方法2: メモ帳**
```cmd
# コマンドプロンプトで実行
cd C:\path\to\your\prooflink-project
notepad .env.local
```

### ステップ2: AWS認証情報を設定

`.env.local` ファイルに以下の内容を追加または編集します：

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres@localhost:5432/prooflink_db

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
NEXT_PUBLIC_ENABLE_CLIENT_LOGGING=true

# AWS S3 Configuration (Development)
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=AKIA...（先ほど保存したアクセスキー）
AWS_SECRET_ACCESS_KEY=...（先ほど保存したシークレットアクセスキー）

# S3 Bucket for Imports (User CSV import)
S3_IMPORT_BUCKET=prooflink-dev-imports

# S3 Bucket for Evidence Files (Optional)
S3_EVIDENCE_BUCKET=prooflink-dev-evidence

# AWS Batch Configuration (後で設定)
# 以下はAWS Batch設定後にコメント解除してください
# AWS_BATCH_JOB_QUEUE=arn:aws:batch:ap-northeast-1:YOUR_ACCOUNT:job-queue/prooflink-dev-queue
# AWS_BATCH_USER_IMPORT_JOB_DEFINITION=arn:aws:batch:ap-northeast-1:YOUR_ACCOUNT:job-definition/prooflink-user-import-dev:1
```

### ステップ3: .gitignoreの確認

`.env.local` が `.gitignore` に含まれていることを確認します。

#### Windowsでの確認方法

**方法1: PowerShell**
```powershell
Get-Content .gitignore | Select-String ".env.local"
```

**方法2: コマンドプロンプト**
```cmd
findstr ".env.local" .gitignore
```

**方法3: エディタで開く**
```powershell
code .gitignore
# または
notepad .gitignore
```

以下のような行があればOK：

```
# local env files
.env*.local
```

もし含まれていない場合は、`.gitignore` に追加してください。

---

## 動作確認

### ステップ1: テスト用CSVファイルの作成

デスクトップなど分かりやすい場所に、以下の内容でCSVファイルを作成します。

#### Windowsでの作成方法

**方法1: メモ帳で作成**

1. デスクトップを右クリック → 新規作成 → テキスト ドキュメント
2. ファイル名を `test-users.csv` に変更
3. メモ帳で開いて以下の内容を貼り付け：

```csv
id,email,name,user_role,department,company,password
,test1@example.com,テストユーザー1,3,開発部,テスト株式会社,Password123!
,test2@example.com,テストユーザー2,2,品質保証部,テスト株式会社,Password123!
```

4. 保存

**方法2: PowerShellで作成**

```powershell
@"
id,email,name,user_role,department,company,password
,test1@example.com,テストユーザー1,3,開発部,テスト株式会社,Password123!
,test2@example.com,テストユーザー2,2,品質保証部,テスト株式会社,Password123!
"@ | Out-File -FilePath "$env:USERPROFILE\Desktop\test-users.csv" -Encoding UTF8
```

### ステップ2: 開発サーバーの起動

#### PowerShellまたはコマンドプロンプトで実行

```powershell
# プロジェクトディレクトリに移動
cd C:\path\to\your\prooflink-project

# 開発サーバー起動
npm run dev
```

以下のような出力が表示されればOK：

```
▲ Next.js 15.5.9
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000

✓ Ready in 2.9s
```

### ステップ3: ブラウザでアクセス

1. ブラウザで `http://localhost:3000` を開く
2. システム管理者アカウントでログイン

### ステップ4: ユーザーインポート画面を開く

1. メニューから「ユーザーインポート」を選択
   - または直接URL: `http://localhost:3000/user-import`

### ステップ5: CSVファイルをアップロード

1. 「CSVファイルをアップロード」セクションで、作成した `test-users.csv` を選択
2. 「アップロードしてインポート実行」ボタンをクリック

#### 期待される動作

✅ **S3アップロードが成功する場合**:
- プリサインドURLが生成される
- ブラウザから直接S3にファイルがアップロードされる
- モーダルに「インポートジョブを起動しました」と表示される

❌ **AWS Batchジョブの起動がエラーになる場合**:
- これは正常です（AWS Batchはまだ設定していないため）
- S3へのアップロード自体は成功しています

### ステップ6: AWS ConsoleでS3アップロードを確認

1. **別のブラウザタブでAWS Management Consoleを開く**
   - https://console.aws.amazon.com/s3/

2. **バケット一覧から `prooflink-dev-imports` をクリック**

3. **フォルダ構成を確認**:
   ```
   prooflink-dev-imports/
   └── user-imports/
       └── test-users-20260117-123456.csv
   ```

4. **アップロードされたCSVファイルが存在すればテスト成功！**

### ステップ7: ファイル内容の確認（オプション）

1. アップロードされたCSVファイル名をクリック
2. 「開く」または「ダウンロード」でファイル内容を確認
3. アップロードした内容と一致していればOK

---

## トラブルシューティング

### エラー1: アクセスキーが無効

**エラーメッセージ**:
```
The security token included in the request is invalid
```

**原因**:
- `.env.local` のアクセスキーまたはシークレットアクセスキーが間違っている
- キーに余計なスペースや改行が含まれている

**解決策**:
1. `.env.local` のキーをコピー＆ペーストし直す
2. 前後にスペースがないことを確認
3. 開発サーバーを再起動: `npm run dev`

### エラー2: バケットへのアクセス拒否

**エラーメッセージ**:
```
Access Denied
```

**原因**:
- IAMユーザーに適切なS3権限がアタッチされていない
- バケット名が `.env.local` と一致していない

**解決策**:

#### 2-1. IAM権限を確認

1. AWS Console → IAM → ユーザー → `prooflink-developer`
2. 「アクセス許可」タブを確認
3. `ProofLink-Development-S3-Access` または `AmazonS3FullAccess` がアタッチされているか確認
4. アタッチされていない場合は、「アクセス許可を追加」から追加

#### 2-2. バケット名を確認

1. `.env.local` の `S3_IMPORT_BUCKET` の値を確認
2. AWS Console → S3 でバケット名を確認
3. 一致しない場合は、`.env.local` を修正して開発サーバーを再起動

### エラー3: バケットが見つからない

**エラーメッセージ**:
```
The specified bucket does not exist
```

**原因**:
- バケットが作成されていない
- バケット名が間違っている
- リージョンが異なる

**解決策**:

1. AWS Console → S3 でバケットが存在するか確認
2. 存在しない場合は、[S3バケットの作成](#s3バケットの作成)を参照して作成
3. `.env.local` のバケット名を確認
4. `.env.local` の `AWS_REGION` が `ap-northeast-1` になっているか確認

### エラー4: プリサインドURL生成エラー

**エラーメッセージ**:
```
Error generating presigned URL
```

**原因**:
- AWS SDK初期化エラー
- 認証情報が正しく読み込まれていない

**解決策**:

1. 開発サーバーのコンソールログを確認
2. `.env.local` を保存し直す
3. 開発サーバーを完全に停止して再起動:
   - `Ctrl+C` で停止
   - `npm run dev` で再起動

### エラー5: CORS エラー

**エラーメッセージ**（ブラウザのコンソール）:
```
Access to fetch at 'https://s3.amazonaws.com/...' has been blocked by CORS policy
```

**原因**:
- S3バケットにCORSポリシーが設定されていない

**解決策**:

1. AWS Console → S3 → `prooflink-dev-imports` バケットを開く
2. 「アクセス許可」タブをクリック
3. 「クロスオリジンリソース共有 (CORS)」セクションまでスクロール
4. 「編集」ボタンをクリック
5. 以下のJSON内容を貼り付け:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE"
    ],
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002"
    ],
    "ExposeHeaders": [
      "ETag"
    ]
  }
]
```

6. 「変更を保存」をクリック
7. ブラウザをリロードして再度アップロードを試す

### デバッグのヒント

#### 1. ブラウザの開発者ツールでネットワークを確認

1. ブラウザで `F12` キーを押して開発者ツールを開く
2. 「ネットワーク」タブを選択
3. CSVアップロードを実行
4. 以下のリクエストを確認:
   - `/api/batch/upload-url` → プリサインドURL生成
   - `s3.amazonaws.com` → S3へのアップロード
   - `/api/batch/user-import` → バッチジョブ起動（エラーになってもOK）

#### 2. サーバーログを確認（Windows）

PowerShellまたはコマンドプロンプトで開発サーバーのコンソール出力を確認:
```powershell
npm run dev
```

エラーが発生した場合、詳細なスタックトレースが表示されます。

#### 3. 手動でS3アップロードをテスト（AWS Console経由）

1. AWS Console → S3 → `prooflink-dev-imports`
2. 「アップロード」ボタンをクリック
3. テスト用ファイルを選択してアップロード
4. アップロードが成功すれば、S3バケット自体は正常
5. アプリケーション側の問題に絞り込める

---

## まとめ

### チェックリスト

設定が完了したら、以下を確認してください：

- [ ] IAMユーザー `prooflink-developer` を作成
- [ ] アクセスキーとシークレットアクセスキーを発行
- [ ] S3バケット `prooflink-dev-imports` を作成
- [ ] `.env.local` に認証情報を設定
- [ ] `.env.local` が `.gitignore` に含まれていることを確認
- [ ] ローカル開発サーバーを起動（Windows環境）
- [ ] ユーザーインポート画面からCSVファイルをアップロード
- [ ] AWS Console → S3 でファイルがアップロードされたことを確認

### 次のステップ

S3アップロードが動作確認できたら、次は以下の設定に進みます：

1. **AWS Batchの設定**: `docs/AWS_DEPLOYMENT_GUIDE.md` の「15. AWS Batchの設定」を参照
2. **開発環境でのバッチジョブテスト**: `docs/AWS_DEPLOYMENT_GUIDE.md` の「付録D: 開発環境のセットアップ」を参照

### 参考リンク

- [AWS IAM ユーザーガイド](https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/)
- [Amazon S3 ユーザーガイド](https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

---

**作成日**: 2026-01-17
**最終更新**: 2026-01-17
**対象環境**: Windows 10/11
