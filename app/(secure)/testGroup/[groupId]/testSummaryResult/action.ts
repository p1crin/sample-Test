'use server';

import { prisma } from '@/app/lib/prisma';
import serverLogger from '@/utils/server-logger';
import { TestSummaryResultListRow } from "./_componets/types/test-summary-result-list-row";

interface GetDataListParams {
  groupId: number;
  page?: number;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getDataCount(groupId: number): Promise<Result<number>> {
  try {
    serverLogger.info(`getDataCount Request`, { groupId });

    // Prisma を使用して直接データベースをクエリ
    const aggregatedData = await prisma.$queryRaw`
      SELECT
        tc.first_layer,
        tc.second_layer,
        COUNT(*)::integer AS total_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK', 'NG') THEN 1 ELSE 0 END), 0)::integer AS completed_items,
        COALESCE(SUM(CASE WHEN tr.judgment = '未着手' THEN 1 ELSE 0 END), 0)::integer AS not_started_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('保留', 'QA中') THEN 1 ELSE 0 END), 0)::integer AS in_progress_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK') THEN 1 ELSE 0 END), 0)::integer AS ok_items,
        COALESCE(SUM(CASE WHEN tr.judgment = 'NG' THEN 1 ELSE 0 END), 0)::integer AS ng_items,
        COALESCE(SUM(CASE WHEN tr.judgment = '対象外' THEN 1 ELSE 0 END), 0)::integer AS excluded_items,
        CASE
          WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK') THEN 1 ELSE 0 END), 0)::float / COUNT(*)
          ELSE 0
        END AS ok_rate,
        CASE
          WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK', 'NG') THEN 1 ELSE 0 END), 0)::float / COUNT(*)
          ELSE 0
        END AS progress_rate
      FROM
        tt_test_results tr
      JOIN
        tt_test_cases tc
      ON
        tr.test_group_id = tc.test_group_id AND tr.tid = tc.tid
      WHERE
        tr.test_group_id = ${groupId}
        AND tr.is_deleted = FALSE
        AND tc.is_deleted = FALSE
      GROUP BY
        tc.first_layer, tc.second_layer
      ORDER BY
        tc.first_layer, tc.second_layer
    `;

    const totalCount = (aggregatedData as unknown[]).length;
    serverLogger.info(`getDataCount Success`, { groupId, totalCount });
    return { success: true, data: totalCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    serverLogger.error('Error fetching data count:', { groupId, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

export async function getDataList(params: GetDataListParams): Promise<Result<TestSummaryResultListRow[]>> {
  try {
    const { groupId, page = 1 } = params;
    serverLogger.info(`getDataList Request`, { groupId, page });

    // Prisma を使用して直接データベースをクエリ
    const aggregatedData = await prisma.$queryRaw`
      SELECT
        tc.first_layer,
        tc.second_layer,
        COUNT(*)::integer AS total_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK', 'NG') THEN 1 ELSE 0 END), 0)::integer AS completed_items,
        COALESCE(SUM(CASE WHEN tr.judgment = '未着手' THEN 1 ELSE 0 END), 0)::integer AS not_started_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('保留', 'QA中') THEN 1 ELSE 0 END), 0)::integer AS in_progress_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK') THEN 1 ELSE 0 END), 0)::integer AS ok_items,
        COALESCE(SUM(CASE WHEN tr.judgment = 'NG' THEN 1 ELSE 0 END), 0)::integer AS ng_items,
        COALESCE(SUM(CASE WHEN tr.judgment = '対象外' THEN 1 ELSE 0 END), 0)::integer AS excluded_items,
        CASE
          WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK') THEN 1 ELSE 0 END), 0)::float / COUNT(*)
          ELSE 0
        END AS ok_rate,
        CASE
          WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK', 'NG') THEN 1 ELSE 0 END), 0)::float / COUNT(*)
          ELSE 0
        END AS progress_rate
      FROM
        tt_test_results tr
      JOIN
        tt_test_cases tc
      ON
        tr.test_group_id = tc.test_group_id AND tr.tid = tc.tid
      WHERE
        tr.test_group_id = ${groupId}
        AND tr.is_deleted = FALSE
        AND tc.is_deleted = FALSE
      GROUP BY
        tc.first_layer, tc.second_layer
      ORDER BY
        tc.first_layer, tc.second_layer
    `;

    // ページネーション処理
    const pageSize = 10;
    const offset = (page - 1) * pageSize;
    const paginatedData = (aggregatedData as any[]).slice(offset, offset + pageSize);

    // データを TestSummaryResultListRow にマッピング
    const mappedData: TestSummaryResultListRow[] = paginatedData.map((item: any) => ({
      firstLayer: item.first_layer,
      secondLayer: item.second_layer,
      totalCount: item.total_items,
      targetCount: item.total_items - item.excluded_items,
      completedCount: item.completed_items,
      notStartedCount: item.not_started_items,
      inProgressCount: item.in_progress_items,
      okCount: item.ok_items,
      ngCount: item.ng_items,
      excludedCount: item.excluded_items,
      okRate: parseFloat((item.ok_rate * 100).toFixed(1)),
      progressRate: parseFloat((item.progress_rate * 100).toFixed(1)),
    }));

    return { success: true, data: mappedData };
  } catch (error) {
    serverLogger.error('Error fetching data list:', error instanceof Error ? error.message : String(error));
    return { success: false, error: 'Failed to fetch data.' };
  }
}