import pino from 'pino';

/**
 * バッチ処理用ロガー
 *
 * AWS ECS/Fargateで動作する場合、awslogsドライバーがstdoutを
 * 自動的にCloudWatch Logsに送信するため、pinoはJSON形式で
 * stdoutに出力するだけでOK
 */
class BatchLogger {
  private logger: pino.Logger;
  private batchName: string;

  constructor(batchName: string = 'batch') {
    this.batchName = batchName;
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

    this.logger = pino(
      {
        level: logLevel,
        // 本番環境では構造化JSON、開発環境では読みやすい形式
        transport: isDevelopment
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
        // 本番環境用の設定
        formatters: {
          level: (label) => {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        base: {
          env: process.env.NODE_ENV,
          logSource: 'batch',
          batchName: this.batchName,
        },
      }
    );
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.logger.debug(data, message);
    } else {
      this.logger.debug(message);
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.logger.info(data, message);
    } else {
      this.logger.info(message);
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.logger.warn(data, message);
    } else {
      this.logger.warn(message);
    }
  }

  error(message: string, error?: unknown, data?: Record<string, unknown>): void {
    const errorData: Record<string, unknown> = { ...data };

    if (error instanceof Error) {
      errorData.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (error !== undefined) {
      errorData.error = error;
    }

    if (Object.keys(errorData).length > 0) {
      this.logger.error(errorData, message);
    } else {
      this.logger.error(message);
    }
  }

  /**
   * 進捗ログ用のヘルパー
   */
  progress(current: number, total: number, message: string, data?: Record<string, unknown>): void {
    const progressData = {
      ...data,
      progress: {
        current,
        total,
        percentage: Math.round((current / total) * 100),
      },
    };
    this.logger.info(progressData, message);
  }

  /**
   * バッチ開始ログ
   */
  startBatch(message: string, config?: Record<string, unknown>): void {
    this.logger.info({ event: 'batch_start', config }, message);
  }

  /**
   * バッチ完了ログ
   */
  endBatch(message: string, summary?: Record<string, unknown>): void {
    this.logger.info({ event: 'batch_end', summary }, message);
  }

  /**
   * 子ロガーを作成（追加のコンテキストを付与）
   */
  child(bindings: Record<string, unknown>): BatchLogger {
    const childLogger = Object.create(this);
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }
}

// デフォルトのロガーをエクスポート
const logger = new BatchLogger();

// 名前付きロガーを作成するファクトリ関数
export function createBatchLogger(batchName: string): BatchLogger {
  return new BatchLogger(batchName);
}

export default logger;
