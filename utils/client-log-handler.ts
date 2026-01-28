import pino from 'pino';
import pinoCloudwatch from 'pino-cloudwatch';

interface ClientLogData {
  screenName: string;
  message: string;
  params?: any[];
  userId?: number | string;
  userAgent: string;
  url: string;
  clientTimestamp: string;
}

class ClientLogHandler {
  private logger: pino.Logger;

  constructor() {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isCloudWatchEnabled = process.env.ENABLE_CLOUDWATCH_LOGS === 'true';

    // 本番環境でCloudWatchが有効な場合は直接CloudWatchに送信
    const shouldUseCloudWatch = !isDevelopment && isCloudWatchEnabled;

    let stream;
    if (shouldUseCloudWatch) {
      const logGroupName = process.env.CLOUDWATCH_CLIENT_LOG_GROUP || '/ecs/prooflink-prod-app-client';
      const logStreamName = `client-${new Date().toISOString().split('T')[0]}-${process.env.HOSTNAME || 'unknown'}`;

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
        level: 'debug',
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
        formatters: {
          level: (label) => {
            return {
              level: label,
            };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        // クライアントログであることを明示するメタデータ
        base: {
          env: process.env.NODE_ENV,
          logSource: 'client',
        },
      },
      stream || undefined
    );
  }

  log(level: string, data: ClientLogData): void {
    const { screenName, message, params, userId, userAgent, url, clientTimestamp } = data;

    const logMessage = `[Client:${screenName}] ${message}`;
    const logData = {
      screenName,
      params,
      userId,
      userAgent,
      url,
      clientTimestamp,
      logSource: 'client',
    };

    switch (level) {
      case 'error':
        this.logger.error(logData, logMessage);
        break;
      case 'warn':
        this.logger.warn(logData, logMessage);
        break;
      case 'info':
        this.logger.info(logData, logMessage);
        break;
      case 'debug':
        this.logger.debug(logData, logMessage);
        break;
      default:
        this.logger.info(logData, logMessage);
    }
  }

  batchLog(logs: Array<{ level: string; data: ClientLogData }>): void {
    logs.forEach(({ level, data }) => {
      this.log(level, data);
    });
    this.logger.info(`Processed ${logs.length} client logs in batch`);
  }
}

const clientLogHandler = new ClientLogHandler();
export default clientLogHandler;
