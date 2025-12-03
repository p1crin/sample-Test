'use server';

import { prisma } from '@/app/lib/prisma';
import { requireAuth } from '@/app/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import serverLogger from '@/utils/server-logger';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // 認証チェック
    const user = await requireAuth(req);

    // FormData をパース
    const formData = await req.formData();
    const groupId = parseInt(formData.get('groupId') as string);
    const tid = formData.get('tid') as string;
    const firstLayer = formData.get('firstLayer') as string;
    const secondLayer = formData.get('secondLayer') as string;
    const thirdLayer = formData.get('thirdLayer') as string;
    const fourthLayer = formData.get('fourthLayer') as string;
    const purpose = formData.get('purpose') as string;
    const requestId = formData.get('requestId') as string;
    const checkItems = formData.get('checkItems') as string;
    const testProcedure = formData.get('testProcedure') as string;
    const controlSpecFile = formData.get('controlSpecFile') as File | null;
    const dataFlowFile = formData.get('dataFlowFile') as File | null;
    const testContentsStr = formData.get('testContents') as string;

    const testContents = testContentsStr ? JSON.parse(testContentsStr) : [];

    // トランザクション開始
    const result = await prisma.$transaction(async (tx) => {
      // tt_test_cases に登録
      const testCase = await tx.tt_test_cases.create({
        data: {
          test_group_id: groupId,
          tid,
          first_layer: firstLayer,
          second_layer: secondLayer,
          third_layer: thirdLayer,
          fourth_layer: fourthLayer,
          purpose,
          request_id: requestId,
          check_items: checkItems,
          test_procedure: testProcedure,
        },
      });

      // ファイル保存処理
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'test-cases', String(groupId), tid);

      // ディレクトリが存在しない場合は作成
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      // 制御仕様書ファイル保存
      if (controlSpecFile) {
        const controlSpecBuffer = await controlSpecFile.arrayBuffer();
        const controlSpecFileName = `control_spec_${Date.now()}_${controlSpecFile.name}`;
        const controlSpecPath = join(uploadDir, controlSpecFileName);
        await writeFile(controlSpecPath, Buffer.from(controlSpecBuffer));

        // tt_test_case_files に記録（type=0: 制御仕様書）
        await tx.tt_test_case_files.create({
          data: {
            test_group_id: groupId,
            tid,
            file_type: 0,
            file_no: 1,
            file_name: controlSpecFile.name,
            file_path: `/uploads/test-cases/${groupId}/${tid}/${controlSpecFileName}`,
          },
        });
      }

      // データフローファイル保存
      if (dataFlowFile) {
        const dataFlowBuffer = await dataFlowFile.arrayBuffer();
        const dataFlowFileName = `data_flow_${Date.now()}_${dataFlowFile.name}`;
        const dataFlowPath = join(uploadDir, dataFlowFileName);
        await writeFile(dataFlowPath, Buffer.from(dataFlowBuffer));

        // tt_test_case_files に記録（type=1: データフロー）
        await tx.tt_test_case_files.create({
          data: {
            test_group_id: groupId,
            tid,
            file_type: 1,
            file_no: 1,
            file_name: dataFlowFile.name,
            file_path: `/uploads/test-cases/${groupId}/${tid}/${dataFlowFileName}`,
          },
        });
      }

      // tt_test_contents に登録
      if (testContents && testContents.length > 0) {
        for (let i = 0; i < testContents.length; i++) {
          const tc = testContents[i];
          await tx.tt_test_contents.create({
            data: {
              test_group_id: groupId,
              tid,
              test_case_no: i + 1,
              test_case: tc.testCase,
              expected_value: tc.expectedValue,
              is_target: !tc.excluded,
            },
          });
        }
      }

      return testCase;
    });

    serverLogger.info('POST /api/test-cases/regist', 'テストケース登録成功', {
      groupId,
      tid,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '予期せぬエラーが発生しました';
    serverLogger.error('POST /api/test-cases/regist', 'テストケース登録失敗', {
      error: errorMessage,
    });

    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
