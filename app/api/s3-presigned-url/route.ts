import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// POST /api/s3-presigned-url - Get presigned URL for file upload
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);

    const body = await req.json();
    const { fileName, fileType, folder } = body;

    // Validate folder parameter
    if (!folder || typeof folder !== 'string') {
      return NextResponse.json(
        { error: 'フォルダ名が指定されていません' },
        { status: 400 }
      );
    }

    // S3 is not configured yet, return placeholder response
    return NextResponse.json(
      {
        error: 'S3機能は現在設定されていません。環境変数でAWS認証情報を設定してください。',
        configured: false
      },
      { status: 501 }
    );

    /* When S3 is configured, uncomment this code:

    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-northeast-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      return NextResponse.json(
        { error: 'S3バケット名が設定されていません' },
        { status: 500 }
      );
    }

    // Always upload to temp/ folder first
    // Files will be copied to production folder on registration
    // S3 lifecycle policy will auto-delete temp/ files after 24 hours
    const tempKey = `temp/${folder}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: tempKey,
      ContentType: fileType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return NextResponse.json({
      presignedUrl,
      tempS3Key: tempKey,
      bucketName,
    });
    */
  } catch (error) {
    console.error('POST /api/s3-presigned-url error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: '署名付きURLの生成に失敗しました' },
      { status: 500 }
    );
  }
}
