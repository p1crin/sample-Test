type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  optionalParams?: unknown[];
}

class ServerLogger {
  private level: LogLevel;

  constructor() {
    this.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatLog(level: LogLevel, message: string, ...optionalParams: unknown[]): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      optionalParams,
    };
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

  debug(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatLog('debug', message, optionalParams));
    }
  }

  info(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog('info')) {
      this.output(this.formatLog('info', message, optionalParams));
    }
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatLog('warn', message, optionalParams));
    }
  }

  error(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog('error')) {
      this.output(this.formatLog('error', message, optionalParams));
    }
  }
}

const serverLogger = new ServerLogger();
export default serverLogger;
