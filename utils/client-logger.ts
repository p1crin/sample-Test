type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class ClientLogger {
  private level: LogLevel;

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
    return optionalParams
      ? `${prefix} ${message} ${JSON.stringify(optionalParams, null, 2)}`
      : `${prefix} ${message}`;
  }

  debug(componentName: string, message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage(componentName, message, optionalParams));
    }
  }

  info(componentName: string, message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(componentName, message, optionalParams));
    }
  }

  warn(componentName: string, message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(componentName, message, optionalParams));
    }
  }

  error(componentName: string, message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(componentName, message, optionalParams));
    }
  }
}

const clientLogger = new ClientLogger();
export default clientLogger;
