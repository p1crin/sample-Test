import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { fromEnv } from '@aws-sdk/credential-provider-env';
import pino from 'pino';

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

    // ENABLE_CLOUDWATCH_LOGS=true の場合はCloudWatchに送信（結合テスト向けに環境制限を撤廃）
    const shouldUseCloudWatch = isCloudWatchEnabled;

    let stream;
    if (shouldUseCloudWatch) {
      const logGroupName = process.env.CLOUDWATCH_CLIENT_LOG_GROUP || '/ecs/prooflink-prod-app-client';
      const logStreamName = `client-${new Date().toISOString().split('T')[0]}-${process.env.HOSTNAME || 'unknown'}`;

      const cloudWatchClient = new CloudWatchLogsClient({
        region: process.env.AWS_REGION || 'ap-northeast-1',
        credentials: fromEnv(),
      });

      stream = {
        write: async (msg: string) => {
          try {
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
            // Note: CloudWatch Logsへの送信結果を待たずに処理を続行させるため、awaitはつけない。
            // もし送信完了まで待ちたい場合は `await cloudWatchClient.send(command);` とする。
            cloudWatchClient.send(command);
          } catch (error) {
            // CloudWatchへのログ送信エラーをコンソールに出力
            // ここでエラーをthrowするとアプリケーションが停止する可能性があるため、ログ出力に留める
            console.error('Failed to send log to CloudWatch:', error);
          }
        },
      };
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
