import clientLogHandler from '@/utils/client-log-handler';
import { NextRequest, NextResponse } from 'next/server';

interface ClientLogRequest {
  level: 'debug' | 'info' | 'warn' | 'error';
  screenName: string;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any[];
  metadata: {
    timestamp: string;
    userId?: number | string;
    userAgent: string;
    url: string;
  };
}

interface BatchLogRequest {
  logs: ClientLogRequest[];
}

function processLog(log: ClientLogRequest): void {
  const { level, screenName, message, params, metadata } = log;

  // クライアントログ専用ハンドラーで処理
  clientLogHandler.log(level, {
    screenName,
    message,
    params,
    userId: metadata.userId,
    userAgent: metadata.userAgent,
    url: metadata.url,
    clientTimestamp: metadata.timestamp,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // バッチログか単一ログかを判定
    if ('logs' in body) {
      // バッチログの処理
      const batchRequest = body as BatchLogRequest;
      const logsWithData = batchRequest.logs.map((log) => ({
        level: log.level,
        data: {
          screenName: log.screenName,
          message: log.message,
          params: log.params,
          userId: log.metadata.userId,
          userAgent: log.metadata.userAgent,
          url: log.metadata.url,
          clientTimestamp: log.metadata.timestamp,
        },
      }));
      clientLogHandler.batchLog(logsWithData);
    } else {
      // 単一ログの処理（後方互換性のため）
      const singleRequest = body as ClientLogRequest;
      processLog(singleRequest);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    // ログAPI自体のエラーは静かに処理（ログの失敗でアプリを止めない）
    console.error('Failed to process client log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process log' },
      { status: 500 }
    );
  }
}