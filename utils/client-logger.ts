type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface ClientLogEntry {
  level: LogLevel;
  componentName: string;
  message: string;
  params?: unknown[];
  timestamp: string;
  userAgent: string;
  url: string;
}

/**
 * クライアント側ロガー
 * - ローカルコンソールに出力
 * - 本番環境ではAPIエンドポイント経由でサーバー側にも送信（CloudWatch Logsに記録）
 */
class ClientLogger {
  private level: LogLevel;
  private logQueue: ClientLogEntry[] = [];
  private isFlushingLogs = false;

  constructor() {
    // 本番環境での有効/無効を環境変数で制御
    this.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  }

  private isEnabled(): boolean {
    return process.env.NEXT_PUBLIC_ENABLE_CLIENT_LOGGING === 'true';
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isEnabled()) return false;
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(componentName: string, message: string, ...optionalParams: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${componentName}]`;
    return optionalParams && optionalParams.length > 0
      ? `${prefix} ${message} ${JSON.stringify(optionalParams, null, 2)}`
      : `${prefix} ${message}`;
  }

  /**
   * 本番環境でCloudWatchに送信（非同期）
   */
  private async sendToCloudWatch(logEntry: ClientLogEntry): Promise<void> {
    // 開発環境では送信しない
    if (process.env.NODE_ENV !== 'production') return;

    // キューに追加
    this.logQueue.push(logEntry);

    // フラッシュを定期的に実行（最大10個のログをバッチで送信）
    if (this.logQueue.length >= 10 || !this.isFlushingLogs) {
      this.flushLogs();
    }
  }

  /**
   * キューに溜まったログをサーバーに送信
   */
  private async flushLogs(): Promise<void> {
    if (this.isFlushingLogs || this.logQueue.length === 0) return;

    this.isFlushingLogs = true;
    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsToSend }),
      });

      if (!response.ok) {
        console.warn('Failed to send logs to server:', response.status);
        // 送信失敗時はキューに戻す（最大3回までリトライ）
        if (logsToSend.length > 0) {
          this.logQueue.unshift(...logsToSend.slice(0, 3));
        }
      }
    } catch (error) {
      // ネットワークエラー時は静かに処理（ユーザー体験を損なわない）
      console.warn('Error sending logs:', error instanceof Error ? error.message : 'Unknown error');
      // 一部をキューに戻す
      if (logsToSend.length > 0) {
        this.logQueue.unshift(...logsToSend.slice(0, 3));
      }
    } finally {
      this.isFlushingLogs = false;
    }
  }

  debug(componentName: string, message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage(componentName, message, context ? [context] : []);
      console.debug(formatted);

      if (typeof window !== 'undefined') {
        this.sendToCloudWatch({
          level: 'debug',
          componentName,
          message,
          params: context ? [context] : [],
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        });
      }
    }
  }

  info(componentName: string, message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage(componentName, message, context ? [context] : []);
      console.info(formatted);

      if (typeof window !== 'undefined') {
        this.sendToCloudWatch({
          level: 'info',
          componentName,
          message,
          params: context ? [context] : [],
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        });
      }
    }
  }

  warn(componentName: string, message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage(componentName, message, context ? [context] : []);
      console.warn(formatted);

      if (typeof window !== 'undefined') {
        this.sendToCloudWatch({
          level: 'warn',
          componentName,
          message,
          params: context ? [context] : [],
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        });
      }
    }
  }

  error(componentName: string, message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      const formatted = this.formatMessage(componentName, message, context ? [context] : []);
      console.error(formatted);

      if (typeof window !== 'undefined') {
        this.sendToCloudWatch({
          level: 'error',
          componentName,
          message,
          params: context ? [context] : [],
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        });
      }
    }
  }

  /**
   * ページを離れるときに未送信ログをフラッシュ
   */
  flushOnExit(): void {
    if (this.logQueue.length > 0 && typeof window !== 'undefined') {
      // navigator.sendBeacon は同期的にデータを送信（ページ遷移時でも安全）
      navigator.sendBeacon('/api/logs', JSON.stringify({ logs: this.logQueue }));
      this.logQueue = [];
    }
  }
}

const clientLogger = new ClientLogger();

// ページを離れるときに未送信ログをフラッシュ
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clientLogger.flushOnExit();
  });
}

export default clientLogger;
