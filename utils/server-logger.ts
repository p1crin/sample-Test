import pino from 'pino';
import pinoCloudwatch from 'pino-cloudwatch';

class ServerLogger {
  private logger: pino.Logger;

  constructor() {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
    const isCloudWatchEnabled = process.env.ENABLE_CLOUDWATCH_LOGS === 'true';

    // 本番環境でCloudWatchが有効な場合は直接CloudWatchに送信
    const shouldUseCloudWatch = !isDevelopment && isCloudWatchEnabled;

    let stream;
    if (shouldUseCloudWatch) {
      const logGroupName = process.env.CLOUDWATCH_SERVER_LOG_GROUP || '/ecs/prooflink-prod-app-server';
      const logStreamName = `server-${new Date().toISOString().split('T')[0]}-${process.env.HOSTNAME || 'unknown'}`;

      stream = pinoCloudwatch({
        logGroupName,
        logStreamName,
        awsRegion: process.env.AWS_REGION || 'ap-northeast-1',
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        interval: 1000, // 1秒ごとにバッチ送信
      });
    }

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
          logSource: 'server',
        },
      },
      stream || undefined
    );
  }

  debug(message: string, ...optionalParams: any[]): void {
    if (optionalParams.length > 0) {
      this.logger.debug({ data: optionalParams }, message);
    } else {
      this.logger.debug(message);
    }
  }

  info(message: string, ...optionalParams: any[]): void {
    if (optionalParams.length > 0) {
      this.logger.info({ data: optionalParams }, message);
    } else {
      this.logger.info(message);
    }
  }

  warn(message: string, ...optionalParams: any[]): void {
    if (optionalParams.length > 0) {
      this.logger.warn({ data: optionalParams }, message);
    } else {
      this.logger.warn(message);
    }
  }

  error(message: string, ...optionalParams: any[]): void {
    if (optionalParams.length > 0) {
      this.logger.error({ data: optionalParams }, message);
    } else {
      this.logger.error(message);
    }
  }
}

const serverLogger = new ServerLogger();
export default serverLogger;
