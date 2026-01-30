# Node.js LTS版を使用
FROM node:20-slim

# 作業ディレクトリを設定
WORKDIR /app

# Prismaに必要なOpenSSLライブラリをインストール
RUN apt-get update -y && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

# Jfrog用の.npmrcをコピー（必要な場合はコメントを外す）
# COPY .npmrc ./

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール（ビルドにdevDependenciesが必要）
RUN npm ci

# Prisma schemaをコピー（ローカルのschema.prismaを使用）
COPY prisma ./prisma

# Prisma Clientを生成
RUN npx prisma generate

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN npm run build

# 本番用にdevDependenciesを削除
RUN npm prune --omit=dev

# 環境変数の設定（実行時に上書き可能）
ENV NODE_ENV=production

# デフォルトのエントリーポイント
CMD ["node", "dist/user-import.js"]
