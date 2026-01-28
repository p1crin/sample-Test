import { formatDateTimeForLogs } from "./date-formatter";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface ClientLogData {
  level: LogLevel;
  screenName: string;
  message: string;
  params?: any[];
  metadata: {
    timestamp: string;
    userId?: number | string;
    userAgent: string;
    url: string;
  };
}

class ClientLogger {
  private isEnabled: boolean;
  private level: LogLevel;
  private userId: number | string | undefined;
  private shouldSendToServer: boolean;
  private sendLevel: LogLevel;
  private logQueue: ClientLogData[];
  private batchSize: number;
  private batchInterval: number;
  private flushTimer: NodeJS.Timeout | number | null;
  private isFlushing: boolean;

  constructor() {
    const env = process.env.NODE_ENV;

    // 開発環境ではコンソール出力、本番環境ではサーバー送信
    this.isEnabled = env !== 'production';
    this.shouldSendToServer = env === 'production';
    this.level = env === 'production' ? 'warn' : 'debug';
    this.userId = undefined;

    // サーバー送信するログレベルの閾値（環境変数で設定可能）
    this.sendLevel = (process.env.NEXT_PUBLIC_CLIENT_LOG_SEND_LEVEL as LogLevel) || 'warn';

    // バッチ送信の設定
    this.logQueue = [];
    this.batchSize = parseInt(process.env.NEXT_PUBLIC_CLIENT_LOG_BATCH_SIZE || '10', 10);
    this.batchInterval = parseInt(process.env.NEXT_PUBLIC_CLIENT_LOG_BATCH_INTERVAL || '30000', 10);
    this.flushTimer = null;
    this.isFlushing = false;

    // ページ離脱時にキューをフラッシュ
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });
    }
  }

  /**
   * ユーザーIDを設定（認証後に1回呼び出す）
   */
  setUserId(userId: number | string): void {
    this.userId = userId;
  }

  /**
   * ユーザーIDをクリア（ログアウト時に呼び出す）
   */
  clearUserId(): void {
    this.userId = undefined;
  }

  /**
   * 現在設定されているユーザーIDを取得
   */
  getUserId(): number | string | undefined {
    return this.userId;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isEnabled) return false;
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(screenName: string, message: string, ...optionalParams: any[]): string {
    const timestamp = formatDateTimeForLogs(new Date());
    const userInfo = this.userId !== undefined ? ` [user:${this.userId}]` : '';
    const prefix = `[${timestamp}]${userInfo} [${screenName}]`;
    return optionalParams?.length
      ? `${prefix} ${message} ${JSON.stringify(optionalParams, null, 2)}`
      : `${prefix} ${message}`;
  }

  private createLogData(
    level: LogLevel,
    screenName: string,
    message: string,
    ...optionalParams: any[]
  ): ClientLogData {
    return {
      level,
      screenName,
      message,
      params: optionalParams,
      metadata: {
        timestamp: formatDateTimeForLogs(new Date()),
        userId: this.userId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      },
    };
  }

  private shouldSend(level: LogLevel): boolean {
    if (!this.shouldSendToServer) return false;
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.sendLevel);
  }

  private addToQueue(logData: ClientLogData): void {
    this.logQueue.push(logData);

    // バッチサイズに達したら即座にフラッシュ
    if (this.logQueue.length >= this.batchSize) {
      this.flush();
    } else {
      // タイマーをリセットして定期的にフラッシュ
      this.resetFlushTimer();
    }
  }

  private resetFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer as number);
    }
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.batchInterval) as unknown as number;
  }

  /**
   * キューに溜まったログを即座にサーバーに送信
   */
  public flush(): void {
    if (this.isFlushing || this.logQueue.length === 0) {
      return;
    }

    this.isFlushing = true;

    // タイマーをクリア
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer as number);
      this.flushTimer = null;
    }

    // キューのコピーを作成して送信
    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    this.sendBatch(logsToSend).finally(() => {
      this.isFlushing = false;
    });
  }

  private async sendBatch(logs: ClientLogData[]): Promise<void> {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
        // エラーでもアプリを止めないよう、keepaliveを使用
        keepalive: true,
      });
    } catch (error) {
      // ログ送信の失敗は静かに処理（アプリの動作を妨げない）
    }
  }

  debug(screenName: string, message: string, ...optionalParams: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage(screenName, message, ...optionalParams));
    }
    if (this.shouldSend('debug')) {
      this.addToQueue(this.createLogData('debug', screenName, message, ...optionalParams));
    }
  }

  info(screenName: string, message: string, ...optionalParams: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(screenName, message, ...optionalParams));
    }
    if (this.shouldSend('info')) {
      this.addToQueue(this.createLogData('info', screenName, message, ...optionalParams));
    }
  }

  warn(screenName: string, message: string, ...optionalParams: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(screenName, message, ...optionalParams));
    }
    if (this.shouldSend('warn')) {
      this.addToQueue(this.createLogData('warn', screenName, message, ...optionalParams));
    }
  }

  error(screenName: string, message: string, ...optionalParams: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(screenName, message, ...optionalParams));
    }
    if (this.shouldSend('error')) {
      this.addToQueue(this.createLogData('error', screenName, message, ...optionalParams));
    }
  }
}

const clientLogger = new ClientLogger();
export default clientLogger;
