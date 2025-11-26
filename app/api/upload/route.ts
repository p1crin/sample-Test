import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { uploadFileToS3 } from '@/app/lib/s3';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが指定されていません' },
        { status: 400 }
      );
    }

    if (!folder) {
      return NextResponse.json(
        { error: 'フォルダパスが指定されていません' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック（最大100MB）
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'ファイルサイズは100MB以下である必要があります' },
        { status: 400 }
      );
    }

    // 許可されたファイル形式チェック
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'サポートされていないファイル形式です' },
        { status: 400 }
      );
    }

    const { url, key } = await uploadFileToS3(file, folder);

    return NextResponse.json(
      {
        url,
        key,
        fileName: file.name,
        size: file.size,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('POST /api/upload error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'ファイルのアップロードに失敗しました' },
      { status: 500 }
    );
  }
}
