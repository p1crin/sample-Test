/**
 * データベースとSQLのログ出力ユーティリティ
 * SQLクエリの可視化、パフォーマンス計測、環境に応じたログ出力を管理
 */

import serverLogger from './server-logger';

/**
 * SQLプレースホルダーを実値に置き換え
 * 例: "SELECT * FROM users WHERE id = $1" + [123]
 * → "SELECT * FROM users WHERE id = 123"
 */
export function visualizeSQLQuery(query: string, params: unknown[]): string {
  let visualizedQuery = query;

  // $1, $2, ... などのプレースホルダーを実値に置き換え
  params.forEach((param, index) => {
    const placeholder = `$${index + 1}`;
    const value = formatSQLValue(param);
    visualizedQuery = visualizedQuery.replace(
      new RegExp(`\\${placeholder}(?!\\d)`, 'g'),
      value
    );
  });

  return visualizedQuery;
}

/**
 * SQLに表示するパラメータ値をフォーマット
 * - 文字列: シングルクォートで囲み、クォートをエスケープ
 * - 数字: そのまま
 * - null: NULL
 * - 配列: PostgreSQL の ARRAY 構文
 */
function formatSQLValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'string') {
    // シングルクォートをエスケープ
    return `'${value.replace(/'/g, "''")}'`;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (Array.isArray(value)) {
    // PostgreSQL の ANY() または ARRAY コンストラクタ用
    if (value.length === 0) return 'ARRAY[]';
    const formatted = value.map(v => formatSQLValue(v)).join(', ');
    return `ARRAY[${formatted}]`;
  }

  // オブジェクトなどのフォールバック
  return JSON.stringify(value);
}

/**
 * SQLクエリを正規化：余分なスペースと改行を削除
 * 例: "SELECT * FROM\n       users\n       WHERE id = 1"
 * → "SELECT * FROM users WHERE id = 1"
 */
function normalizeSQLQuery(query: string): string {
  return query
    .replace(/\s+/g, ' ') // 複数のスペース/改行を単一のスペースに置換
    .trim();
}

/**
 * データベースクエリをログに出力（実行時間と取得件数付き）
 * 開発環境のみSQLの詳細をログに出力
 */
export interface DatabaseQueryLog {
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION';
  table?: string;
  userId?: number | string;
  executionTime: number; // ミリ秒
  rowsAffected?: number;
  rowsReturned?: number;
  query?: string; // 開発環境のみ設定
  params?: unknown[]; // 開発環境のみ設定
}

export function logDatabaseQuery(log: DatabaseQueryLog): void {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // 開発環境: SQL クエリの詳細をログに出力
    let visualization = log.query && log.params
      ? visualizeSQLQuery(log.query, log.params)
      : log.query || '';

    // 正規化: 改行と余分なスペースを削除
    visualization = normalizeSQLQuery(visualization);

    serverLogger.debug('SQL Query Executed', {
      operation: log.operation,
      table: log.table,
      executionTime: `${log.executionTime.toFixed(2)}ms`,
      rowsAffected: log.rowsAffected,
      rowsReturned: log.rowsReturned,
      query: visualization,
      params: log.params
    });
  } else {
    // 本番環境: メタデータのみ出力（機密情報を避ける）
    serverLogger.info('Database Query', {
      operation: log.operation,
      table: log.table,
      executionTime: `${log.executionTime.toFixed(2)}ms`,
      rowsAffected: log.rowsAffected,
      rowsReturned: log.rowsReturned,
    });
  }
}

/**
 * クエリ実行時間を計測するヘルパークラス
 */
export class QueryTimer {
  private startTime: number;

  constructor() {
    this.startTime = performance.now();
  }

  elapsed(): number {
    return performance.now() - this.startTime;
  }

  elapsedMs(): string {
    return `${this.elapsed().toFixed(2)}ms`;
  }
}

/**
 * クエリパラメータをエンドポイントに追加するヘルパー関数
 */
function appendQueryParams(endpoint: string, params: URLSearchParams): string {
  const queryString = params.toString();
  return queryString ? `${endpoint}?${queryString}` : endpoint;
}

/**
 * APIエンドポイントのログ出力（リクエスト/レスポンス追跡付き）
 */
export interface APILog {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  userId?: number | string;
  statusCode?: number;
  executionTime: number;
  dataSize?: number; // 返却行数または影響行数
  error?: string;
  queryParams?: URLSearchParams;
}

export function logAPIEndpoint(log: APILog): void {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // クエリパラメータをエンドポイントに追加
  const endpointWithParams = log.queryParams
    ? appendQueryParams(log.endpoint, log.queryParams)
    : log.endpoint;

  const message = `${log.method} ${endpointWithParams}`;

  if (log.error) {
    serverLogger.error(message, {
      userId: log.userId,
      statusCode: log.statusCode,
      executionTime: `${log.executionTime.toFixed(2)}ms`,
      error: log.error,
    });
  } else if (isDevelopment) {
    serverLogger.info(message, {
      userId: log.userId,
      statusCode: log.statusCode,
      executionTime: `${log.executionTime.toFixed(2)}ms`,
      dataSize: log.dataSize,
    });
  } else {
    // 本番環境: ログ出力を控えめに
    if (log.executionTime > 1000) {
      // 遅い場合のみ警告
      serverLogger.warn(message, {
        userId: log.userId,
        statusCode: log.statusCode,
        executionTime: `${log.executionTime.toFixed(2)}ms`,
      });
    }
  }
}