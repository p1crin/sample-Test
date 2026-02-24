import { NextResponse } from 'next/server';

/**
 * Health check endpoint for ALB/ECS health checks
 * GET /api/health
 */
export async function GET() {
  try {
    // Basic health check - application is running
    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'prooflink',
      },
      { status: 200 }
    );
  } catch (error) {
    // If any error occurs, return unhealthy status
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}