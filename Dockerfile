# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:20-slim AS deps
WORKDIR /app

# Prismaに必要なOpenSSLライブラリをインストール
RUN apt-get update -y && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci

# ==========================================
# Stage 2: Builder
# ==========================================
FROM node:20-slim AS builder
WORKDIR /app

# OpenSSLをインストール
RUN apt-get update -y && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

# 依存関係をコピー
COPY --from=deps /app/node_modules ./node_modules

# アプリケーションコードをコピー
COPY . .

# Prisma schemaから型定義を生成
RUN npx prisma generate

# Next.jsアプリケーションをビルド
# 環境変数はビルド時に注入されるため、ARGで受け取る
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ==========================================
# Stage 3: Runner (本番環境)
# ==========================================
FROM node:20-slim AS runner
WORKDIR /app

# OpenSSLをインストール
RUN apt-get update -y && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

# 本番環境であることを明示
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.jsユーザーを作成(セキュリティのため)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 必要なファイルのみコピー
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Next.jsのビルド成果物をコピー
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma生成ファイルをコピー
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma

# Prisma Clientを再生成(本番環境用)
RUN npx prisma generate

# 権限を設定
USER nextjs

# ポート3000を公開
EXPOSE 3000

# 環境変数
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# アプリケーション起動
CMD ["node", "server.js"]
