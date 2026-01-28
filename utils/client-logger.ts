import { formatDateTimeForLogs } from "./date-formatter";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class ClientLogger {
  private isEnabled: boolean;
  private level: LogLevel;
  private userId?: number;

  constructor(userId?: number) {
    // 本番環境での有効/無効を環境変数で制御
    this.isEnabled = process.env.NEXT_PUBLIC_ENABLE_CLIENT_LOGGING === 'true';
    this.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
    this.userId = userId;
  }

  /**
   * userIdを設定した新しいロガーインスタンスを返す
   * リクエストごとにuserIdを含めたログを出力する場合に使用
   */
  withUserId(userId: number): ClientLogger {
    const logger = new ClientLogger(userId);
    logger.isEnabled = this.isEnabled;
    logger.level = this.level;
    return logger;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isEnabled) return false;
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(screenName: string, message: string, ...optionalParams: any[]): string {
    const timestamp = formatDateTimeForLogs(new Date());
    const userIdPart = this.userId ? ` [userId:${this.userId}]` : '';
    const prefix = `[${timestamp}]${userIdPart} [${screenName}]`;
    return optionalParams
      ? `${prefix} ${message} ${JSON.stringify(optionalParams, null, 2)}`
      : `${prefix} ${message}`;
  }

  debug(screenName: string, message: string, ...optionalParams: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage(screenName, message, optionalParams));
    }
  }

  info(screenName: string, message: string, ...optionalParams: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(screenName, message, optionalParams));
    }
  }

  warn(screenName: string, message: string, ...optionalParams: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(screenName, message, optionalParams));
    }
  }

  error(screenName: string, message: string, ...optionalParams: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(screenName, message, optionalParams));
    }
  }
}

const clientLogger = new ClientLogger();
export default clientLogger;
