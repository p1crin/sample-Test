# nextjs-skeleton

## 概要

Next.js 15 + TypeScript + Tailwind CSS + Redux Toolkit + shadcn/ui + Zod で構築したスケルトンプロジェクトです。<br />
Reactオンボーディング資料に記載の設計指針やFeature-Sliced Design（FSD）アーキテクチャを採用した構成としており、<br />
各開発案件において、プロジェクトのベースとして利用する事を目的としております。<br />

## 利用に関して

スケルトンプロジェクトには、一般的な業務系Webアプリケーション開発でよくある画面構成や各種部品を含んでおりますが、<br />
認証処理をはじめ仮実装が多く含まれておりますので、システム要件に合わせて適宜修正し利用するようにお願いします。<br />
<br />
なお、現状の認証処理が不完全であり、ログイン状態でログアウトせずにブラウザを立ち上げ直すとログイン状態が維持される動作になっております。<br />
Cookieを削除すれば再度ログインは可能ですのでご注意頂くと共に、利用時には認証周りを全体的に修正するようにお願い致します。<br />

## ディレクトリ構成（FSD: Feature-Sliced Design）

```
app/                  # Next.jsページ・レイアウト（App Router）
  global.css
  layout.tsx          # ルートレイアウト定義
  loading.tsx         # ローディング
  not-found.tsx       # 404ページ
  page.tsx            # ルートページ定義
  provider.tsx        # Redux Providerコンポーネント
  login/              # ログインページ
    _components/      # ログインページ用コンポーネント
    page.tsx          # ログインページ定義
  admin/              # 認証が必要なページ (middleware.tsで制御)
    layout.tsx        # 認証が必要なページ用レイアウト定義
    top/              # TOPページ
      page.tsx        # TOPページ定義
    user/             # ユーザ管理(一覧)ページ
      action.tsx      # ユーザ管理(一覧)ページ用Server Actions(サーバー側で実行される非同期処理)
      page.tsx        # ユーザ管理(一覧)ページ定義
      _components/    # ユーザ管理(一覧)ページ用コンポーネント
      edit/           # ユーザ編集ページ
        action.tsx    # ユーザ編集ページ用Server Actions(サーバー側で実行される非同期処理)
        _components/  # ユーザ編集ページ用コンポーネント
        [id]/         # ユーザ編集ページ動的ルーティング用ディレクトリ
          page.tsx    # ユーザ編集ページ定義
components/           # アプリケーション全体で共有するコンポーネント群
  datagrid/           # データグリッドコンポーネント(一覧表示、ソート、ページネーション等)
  header/             # ヘッダーコンポーネント
  sidebar/            # サイドバーコンポーネント
  ui/                 # 基本UIコンポーネント（shadcn/ui系）
  model/              # ビジネスロジックの中心となるエンティティ型定義
    user.ts           # ユーザーエンティティ
config/               # 設定ファイル群
public/               # 静的ファイル
stores/               # アプリケーション全体のグローバルステートの管理
  feature/            # Reduxレディーサー群
tests/                # テストコード(対象ファイルをディレクトリ構成を合わせてテストファイルを作成)
types/                # アプリケーション全体で共有する型定義
utils/                # ユーティリティ（logger等）
```

## 初期インストール

1. JFrog[https://skygroup.jfrog.io/]を開く。
1. `User Menu`から`Set Me Up`を選択する。
1. `npm`のアイコンをクリックする。
1. `Repository`を`sky-npm-virtual`を選択する。
1. `Generate Token & Create Instructions`をクリックする。
1. VSCodeを起動し、メニューから`ファイルを開く`を選択し、本プロジェクトのフォルダを選択する。
1. エクスプローラーでルートの位置があっているか確認する。package.jsonやREADME.mdが直下にある。
1. ターミナルウインドウを表示する。
1. ターミナルが`Powershell`になっている場合は`cmd`に切り替える。
1. ターミナルにjFrog上に表示される`npm login`のコマンドをコピーして張り付け実行する。
   > 例: npm config set registry https://skygroup.jfrog.io/artifactory/api/npm/sky-npm-virtual/
1. ターミナルにjFrogに表示される次のコマンドをコピーして貼り付けて実行する。
   > 例: npm login --auth-type=web
1. コマンドに「Press ENTER to open in the browser...」が表示されたらEnterを押下する。<br />
   ブラウザが立ち上がり、Jfrogのログイン確認「Is it you trying to login?」がでるのでYesをクリックする。<br />
   コマンドに下記がでればログイン成功。<br />
   > Logged in on https://skygroup.jfrog.io/artifactory/api/npm/sky-npm-remote/.
1. 以下コマンドを実行し、インストールを開始する。
   > npm install utils --loglevel verbose
   >
   > > 途中のログを確認し、以下のように"Skygroup.jfrog.io"になっていれば問題ありません。
   > > npm http fetch GET 200 https://skygroup.jfrog.io/artifactory/api/npm/sky-npm-remote/is-number/-/is-number-2.1.0.tgz 21081ms (cache miss)
1. 完了後にpackage-lock.jsonを確認し、以下のように取得元がjfrogになっているかを確認する。
   > "resolved": "https://skygroup.jfrog.io/artifactory/api/npm/sky-npm-remote/@ampproject/remapping/-/remapping-2.3.0.tgz",
1. `npm run dev`で実行した上で、ブラウザより[http://localhost:3000]へアクセスし画面が開く事を確認する。

## 定義済みのコマンドエイリアス

```bash
# 依存パッケージのインストール
npm install

# 開発サーバーの起動
npm run dev

# テストの実行
npm run test

# ESLintの実行
npm run lint

# フォーマット実行
npm run format

# フォーマットチェック
npm run format:check

# ビルド
npm run build
```

## デバッグ

- VSCode上でデバッグ実行する為の定義
- フルスタック／サーバーサイド／クライアントサイドの3種類

### デバッグ実行時にエラーが出る場合

サーバーサイドでデバッグ実行時に`このシステムではスクリプトの実行が無効になっているため~`のエラーが出る場合は以下手順を実施する。

1. VSCodeの`表示`→`コマンドパレット`を押下して表示された入力欄に`settings`を入力する。
1. `Open Settings(JSON)`を選択してファイルを開く。
1. 以下を追記する。

```json
settings
   "terminal.integrated.env.windows": {
       "PSExecutionPolicyPreference": "RemoteSigned"
   }
```

1. VSCodeを再起動する。

## 主な技術スタック

- Next.js 15
- React 19
- TypeScript 5
- Tailwind CSS 4
- Redux Toolkit
- shadcn/ui
- Zod
- Vitest
- Testing Library

## ブラウザサポート

- Chrome/Edge 最新版

## AWSデプロイメント

### クイックスタート

```bash
# ローカル開発環境のセットアップ
npm install
cp .env.example .env
# .envファイルを編集してデータベース接続情報などを設定
npx prisma migrate dev
npm run dev
```

詳細は [クイックスタートガイド](./docs/QUICKSTART.md) を参照してください。

### 本番環境へのデプロイ

このプロジェクトはAWS ECS Fargateへのデプロイに対応しています。

#### 必要なAWSリソース

- VPC、サブネット、セキュリティグループ
- RDS PostgreSQL
- S3バケット
- ECR(コンテナレジストリ)
- ECS Fargate
- ALB(ロードバランサー)
- Route 53、ACM証明書
- AWS Batch(ユーザーインポート用)

詳細な構築手順は [AWS環境構築ガイド](./docs/AWS_SETUP_GUIDE.md) を参照してください。

> **更新情報(2026-01-23)**: ドキュメントを大幅に改善しました
> - NATゲートウェイ不要の構成に変更(月額3,000〜5,000円のコスト削減)
> - AWSコンソールのみで構築可能(CLI不要)
> - 開発環境向けのコスト最適化設定を追加(月額約6,000円で運用可能)

### 自動デプロイ(CI/CD)

mainブランチへのプッシュで自動的に客先AWS ECSにデプロイされます。

#### セットアップ手順

1. GitLab CI/CD変数の設定
   - `AWS_ACCESS_KEY_ID` (客先AWS)
   - `AWS_SECRET_ACCESS_KEY` (客先AWS)
   - `ECR_REGISTRY` (客先ECRレジストリURL)

2. mainブランチにプッシュ
   ```bash
   git push origin main
   ```

3. GitLab CI/CDが自動的にビルド・デプロイを実行

詳細は [CI/CDセットアップガイド](./docs/CI_CD_SETUP.md) を参照してください。

## ドキュメント

### 環境構築

- [クイックスタートガイド](./docs/QUICKSTART.md) - 最速セットアップ手順
- [AWS環境構築ガイド](./docs/AWS_SETUP_GUIDE.md) - AWS環境構築の詳細手順(開発・本番共通)
- [CI/CDセットアップ](./docs/CI_CD_SETUP.md) - 自動デプロイの設定方法
- [ローカルS3セットアップ](./docs/LOCAL_DEVELOPMENT_S3_SETUP.md) - ローカル開発でS3を使う方法

## 環境変数

アプリケーションで使用する環境変数は `.env.example` を参照してください。

主要な環境変数:

- `DATABASE_URL` - PostgreSQL接続文字列
- `NEXTAUTH_URL` - アプリケーションのベースURL
- `NEXTAUTH_SECRET` - JWT署名用シークレット
- `AWS_REGION` - AWSリージョン
- `AWS_S3_BUCKET_NAME` - S3バケット名(本番環境)
- `AWS_BATCH_JOB_QUEUE` - AWS Batchジョブキュー
- `AWS_BATCH_USER_IMPORT_JOB_DEFINITION` - ユーザーインポートジョブ定義
