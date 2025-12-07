'use server';

import { NextRequest, NextResponse } from 'next/server';
import serverLogger from '@/utils/server-logger';

interface ClientLogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  componentName: string;
  message: string;
  params?: unknown[];
  timestamp: string;
  userAgent: string;
  url: string;
}

interface LogRequest {
  logs: ClientLogEntry[];
}

/**
 * POST /api/logs
 * クライアント側から送信されたログをサーバー側で処理
 * 本番環境ではCloudWatch Logsに出力される
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LogRequest;
    const { logs } = body;

    if (!Array.isArray(logs) || logs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid logs array' },
        { status: 400 }
      );
    }

    // クライアント側のログをサーバー側のロガーで記録
    // 本番環境ではこれがCloudWatch Logsに出力される
    logs.forEach((logEntry) => {
      const context = {
        source: 'client',
        componentName: logEntry.componentName,
        userAgent: logEntry.userAgent,
        url: logEntry.url,
        ...(logEntry.params && { params: logEntry.params }),
      };

      switch (logEntry.level) {
        case 'debug':
          serverLogger.debug(logEntry.message, context);
          break;
        case 'info':
          serverLogger.info(logEntry.message, context);
          break;
        case 'warn':
          serverLogger.warn(logEntry.message, context);
          break;
        case 'error':
          serverLogger.error(logEntry.message, context);
          break;
        default:
          serverLogger.info(logEntry.message, context);
      }
    });

    return NextResponse.json(
      { success: true, processedCount: logs.length },
      { status: 200 }
    );
  } catch (error) {
    serverLogger.error('Failed to process logs from client', error instanceof Error ? error : undefined, {
      source: 'client',
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
