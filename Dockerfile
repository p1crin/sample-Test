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

# COPY .npmrc ./ を削除し、--mount を使って認証情報を安全に渡す
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci


# ==========================================
# Stage 2: Builder
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

# OpenSSLをインストール
RUN apt-get update -y && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

# Stage 1 から依存関係をコピー
COPY --from=deps /app/node_modules ./node_modules

# PrismaスキーマのみをコピーしてDockerレイヤーキャッシュを最大活用
# → アプリコードのみ変更時に prisma generate がキャッシュヒットする
COPY prisma ./prisma

# Prisma Clientを生成（スキーマが変わらない限りキャッシュが有効）
RUN npx prisma generate

# アプリケーションコードをコピー（コード変更時も上記レイヤーはキャッシュ済み）
COPY . .

# Next.jsアプリケーションをビルド
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

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.jsユーザーを作成(セキュリティのため)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 必要なファイルのみコピー
COPY --from=builder /app/public ./public
# Standaloneモードのビルド成果物をコピー
# これには、実行に必要な最小限のnode_modulesも含まれます
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Stage 2 (builder) で生成されたPrisma Clientが .next/standalone に
# 含まれているため、ここでの再生成は不要かつエラーの原因になるため削除
# COPY --from=builder /app/prisma ./prisma
# RUN npx prisma generate

# 権限を設定
USER nextjs

# ポート3000を公開
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# アプリケーション起動
# .next/standalone 内の server.js を実行する
CMD ["node", "server.js"]
