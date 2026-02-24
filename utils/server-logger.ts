import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { fromEnv } from '@aws-sdk/credential-provider-env';
import pino from 'pino';

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

      const cloudWatchClient = new CloudWatchLogsClient({
        region: process.env.AWS_REGION || 'ap-northeast-1',
        credentials: fromEnv(),
      });

      stream = {
        write: async (msg: string) => {
          const params = {
            logGroupName,
            logStreamName,
            logEvents: [
              {
                message: msg,
                timestamp: new Date().getTime(),
              },
            ],
          };
          const command = new PutLogEventsCommand(params);
          await cloudWatchClient.send(command);
        },
      };
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