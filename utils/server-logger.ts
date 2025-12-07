import pino from 'pino';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * ログエントリのインターフェース
 */
interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  optionalParams?: Record<string, unknown>;
}

/**
 * Pinoベースのサーバーロガー
 * - 開発環境: 読みやすいテキスト形式でconsole出力
 * - 本番環境: JSON形式でCloudWatch Logsに出力
 */
class ServerLogger {
  private pinoLogger: pino.Logger;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';

    // Pinoロガーの設定
    if (this.isProduction) {
      // 本番環境: JSON形式でCloudWatch Logsに送信
      // ECSタスク定義でawslogs ログドライバーが設定されていると、
      // 標準出力に出力されたJSON形式のログが自動的にCloudWatch Logsに送信される
      this.pinoLogger = pino({
        level: 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
      });
    } else {
      // 開発環境: 読みやすいテキスト形式で出力
      // Next.js環境ではtransport workerが問題を起こすため、単純なconsoleベースにする
      this.pinoLogger = pino({
        level: 'debug',
        timestamp: pino.stdTimeFunctions.isoTime,
      });
    }
  }

  private output(entry: LogEntry): void {
    const logFn = console[entry.level] || console.log;
    if (process.env.NODE_ENV === 'production') {
      // 本番環境ではJSON形式で出力
      logFn(JSON.stringify(entry));
    } else {
      // 開発環境では読みやすい形式で出力
      const dataStr = entry.optionalParams
        ? ` ${JSON.stringify(entry.optionalParams, null, 2)}`
        : '';
      logFn(`[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${dataStr}`);
    }
  }

  /**
   * デバッグレベルのログを出力
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (this.isProduction) {
      this.pinoLogger.debug(context || {}, message);
    } else {
      this.output({
        level: 'debug',
        timestamp: new Date().toISOString(),
        message,
        optionalParams: context,
      });
    }
  }

  /**
   * インフォレベルのログを出力
   */
  info(message: string, context?: Record<string, unknown>): void {
    if (this.isProduction) {
      this.pinoLogger.info(context || {}, message);
    } else {
      this.output({
        level: 'info',
        timestamp: new Date().toISOString(),
        message,
        optionalParams: context,
      });
    }
  }

  /**
   * 警告レベルのログを出力
   */
  warn(message: string, context?: Record<string, unknown>): void {
    if (this.isProduction) {
      this.pinoLogger.warn(context || {}, message);
    } else {
      this.output({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message,
        optionalParams: context,
      });
    }
  }

  /**
   * エラーレベルのログを出力
   */
  error(message: string, error?: Error | Record<string, unknown>, context?: Record<string, unknown>): void {
    if (error instanceof Error) {
      const errorContext = {
        ...context,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      };
      if (this.isProduction) {
        this.pinoLogger.error(errorContext, message);
      } else {
        this.output({
          level: 'error',
          timestamp: new Date().toISOString(),
          message,
          optionalParams: errorContext,
        });
      }
    } else {
      if (this.isProduction) {
        this.pinoLogger.error(error || context || {}, message);
      } else {
        this.output({
          level: 'error',
          timestamp: new Date().toISOString(),
          message,
          optionalParams: (error || context) as Record<string, unknown> | undefined,
        });
      }
    }
  }

  /**
   * 子ロガーを作成（リクエスト追跡用）
   */
  child(bindings: Record<string, unknown>): ServerLogger {
    const childLogger = new ServerLogger();
    childLogger.pinoLogger = this.pinoLogger.child(bindings);
    return childLogger;
  }
}

const serverLogger = new ServerLogger();
export default serverLogger;
