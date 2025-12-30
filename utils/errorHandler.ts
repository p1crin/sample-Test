import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import { NextResponse } from 'next/server';

export function handleError(error: Error, code: number, apiTimer: QueryTimer, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", endpoint: string) {

  logAPIEndpoint({
    method,
    endpoint,
    statusCode: code,
    executionTime: apiTimer.elapsed(),
    error: error.message,
  });

  switch (code) {
    case STATUS_CODES.UNAUTHORIZED:
      return NextResponse.json(
        {
          error:
          {
            code: code,
            message: error.message || ERROR_MESSAGES.UNAUTHORIZED
          },
        },
        { status: STATUS_CODES.UNAUTHORIZED }
      );
    case STATUS_CODES.FORBIDDEN:
      return NextResponse.json(
        {
          error:
          {
            code: code,
            message: error.message || ERROR_MESSAGES.PERMISSION_DENIED
          }
        },
        { status: STATUS_CODES.FORBIDDEN }
      );
    case STATUS_CODES.NOT_FOUND:
      return NextResponse.json(
        {
          error:
          {
            code: code,
            message: error.message || ERROR_MESSAGES.NOT_FOUND
          }
        },
        { status: STATUS_CODES.NOT_FOUND }
      );
    case STATUS_CODES.BAD_REQUEST:
      return NextResponse.json(
        {
          error:
          {
            code: code,
            message: error.message || ERROR_MESSAGES.BAD_REQUEST
          }
        },
        { status: STATUS_CODES.BAD_REQUEST }
      );
    default:
      console.log("wwe:", error.message);
      return NextResponse.json(
        {
          error:
          {
            code: code,
            message: error.message || ERROR_MESSAGES.INTEREANL_SERVER_ERROR
          }
        },
        { status: STATUS_CODES.INTERNAL_SERVER_ERROR }
      );
  }
}