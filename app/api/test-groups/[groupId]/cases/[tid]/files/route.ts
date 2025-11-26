import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canEditTestCases } from '@/app/lib/auth';
import { query, transaction } from '@/app/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// POST /api/test-groups/[groupId]/cases/[tid]/files - Upload files
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam, tid } = await params;
    const groupId = parseInt(groupIdParam, 10);

    // Check permission (Designer role required)
    const canEdit = await canEditTestCases(user, groupId);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'ファイルをアップロードする権限がありません' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const fileType = parseInt(formData.get('file_type') as string, 10);

    if (files.length === 0) {
      return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 });
    }

    if (fileType !== 0 && fileType !== 1) {
      return NextResponse.json({ error: '無効なファイルタイプです' }, { status: 400 });
    }

    await transaction(async (client) => {
      // Get max file_no for this file_type
      const maxFileNoResult = await client.query(
        `SELECT COALESCE(MAX(file_no), 0) as max_file_no
         FROM tt_test_case_files
         WHERE test_group_id = $1 AND tid = $2 AND file_type = $3`,
        [groupId, tid, fileType]
      );
      let fileNo = maxFileNoResult.rows[0].max_file_no;

      // Upload directory
      const uploadDir = path.join(process.cwd(), 'uploads', 'test-cases', groupId.toString(), tid);
      await mkdir(uploadDir, { recursive: true });

      // Process each file
      for (const file of files) {
        fileNo++;

        // Save file to disk
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${fileType}_${fileNo}_${file.name}`;
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);

        // Save to database
        const relativePath = `/uploads/test-cases/${groupId}/${tid}/${fileName}`;
        await client.query(
          `INSERT INTO tt_test_case_files
           (test_group_id, tid, file_type, file_no, file_name, file_path)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [groupId, tid, fileType, fileNo, file.name, relativePath]
        );
      }
    });

    return NextResponse.json({ message: 'ファイルをアップロードしました' });
  } catch (error) {
    console.error('POST /api/test-groups/[groupId]/cases/[tid]/files error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'ファイルのアップロードに失敗しました' },
      { status: 500 }
    );
  }
}

// DELETE /api/test-groups/[groupId]/cases/[tid]/files - Delete file (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam, tid } = await params;
    const groupId = parseInt(groupIdParam, 10);

    // Check permission (Designer role required)
    const canEdit = await canEditTestCases(user, groupId);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'ファイルを削除する権限がありません' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { file_type, file_no } = body;

    if (file_type === undefined || file_no === undefined) {
      return NextResponse.json(
        { error: 'file_typeとfile_noが必要です' },
        { status: 400 }
      );
    }

    // Soft delete file
    await query(
      `UPDATE tt_test_case_files
       SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE test_group_id = $1 AND tid = $2 AND file_type = $3 AND file_no = $4`,
      [groupId, tid, file_type, file_no]
    );

    return NextResponse.json({ message: 'ファイルを削除しました' });
  } catch (error) {
    console.error('DELETE /api/test-groups/[groupId]/cases/[tid]/files error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'ファイルの削除に失敗しました' },
      { status: 500 }
    );
  }
}
