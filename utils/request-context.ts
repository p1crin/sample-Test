import { AsyncLocalStorage } from 'async_hooks';

/**
 * リクエストスコープのコンテキスト
 * サーバーサイドでリクエストごとにユーザー情報を保持
 */
export interface RequestContext {
  userId?: number | string;
  requestId?: string;
}

// AsyncLocalStorage インスタンス
const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * コンテキスト内でコールバックを実行
 * @param context - リクエストコンテキスト
 * @param callback - 実行するコールバック
 */
export function runWithContext<T>(context: RequestContext, callback: () => T): T {
  return requestContext.run(context, callback);
}

/**
 * 非同期コンテキスト内でコールバックを実行
 * @param context - リクエストコンテキスト
 * @param callback - 実行する非同期コールバック
 */
export async function runWithContextAsync<T>(
  context: RequestContext,
  callback: () => Promise<T>
): Promise<T> {
  return requestContext.run(context, callback);
}

/**
 * 現在のコンテキストからユーザーIDを取得
 */
export function getCurrentUserId(): number | string | undefined {
  return requestContext.getStore()?.userId;
}

/**
 * 現在のコンテキストからリクエストIDを取得
 */
export function getCurrentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

/**
 * 現在のコンテキスト全体を取得
 */
export function getCurrentContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export default requestContext;
