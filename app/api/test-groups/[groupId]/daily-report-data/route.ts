import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { QueryTimer, logAPIEndpoint } from '@/utils/database-logger';

// 型定義
interface DailyAggregateData {
  ngCount: number; // その日のNG数（Daily）
  cumulativeOkCount: number; // その日時点の累計OK数（実績）
  cumulativeNgCount: number; // その日時点の累計NG数（実績）
  unresolvedNgCount: number; // その日時点の未解決不具合数（日毎の最新試験結果がNGとなっている件数）
}

// JSTの日付文字列を生成するヘルパー関数
const toJSTDateString = (date: Date): string => {
  // ISO形式（UTC）に変換後、日本のタイムゾーン(+09:00)を考慮して日付キーを生成
  // date-fns-tz等のライブラリを使用するのが理想的だが、ここでは簡易的に9時間分のミリ秒を調整
  const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jstDate.toISOString().split('T')[0];
};

// GET /api/test-groups/[groupId]/daily-report-data - Get daily report data for graph
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam } = await params;
    const groupId = parseInt(groupIdParam, 10);

    if (isNaN(groupId)) {
      // (エラーハンドリングは省略せず維持)
      statusCode = 400;
      // logAPIEndpoint({ /* ... */ });
      return NextResponse.json(
        { success: false, error: 'グループIDが無効です' },
        { status: 400 }
      );
    }

    // Check permission
    const canView = await canViewTestGroup(user.id, user.user_role, groupId);
    if (!canView) {
      // (権限チェックも省略せず維持)
      statusCode = 403;
      // logAPIEndpoint({ /* ... */ });
      return NextResponse.json(
        { success: false, error: 'アクセス権限がありません' },
        { status: 403 }
      );
    }

    // Verify test group exists
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: { id: groupId },
      select: { id: true, test_startdate: true, test_enddate: true, ng_plan_count: true, is_deleted: true },
    });

    if (!testGroup || testGroup.is_deleted) {
      // (グループ存在チェックも省略せず維持)
      statusCode = 404;
      // logAPIEndpoint({ /* ... */ });
      return NextResponse.json(
        { success: false, error: 'テストグループが見つかりません' },
        { status: 404 }
      );
    }

    // --- 1. 履歴データ（グラフ描画用）の取得 ---
    // ★tt_test_results_historyから全履歴を取得する
    const historicalActivities = await prisma.tt_test_results_history.findMany({
      where: {
        test_group_id: groupId,
        is_deleted: false,
      },
      select: {
        execution_date: true,
        judgment: true,
        tid: true,
        test_case_no: true,
        version: true,
        history_count: true,
      },
      orderBy: [
        { execution_date: 'asc' },
        { history_count: 'asc' } // 同日実行はhistory_count順
      ],
    });

    // --- 2. 総テスト項目数の取得（分母）---
    const totalTestItems = await prisma.tt_test_contents.count({
      where: {
        test_group_id: groupId,
        is_deleted: false,
      },
    });

    // --- 4. 日次データの集計（日付の連続性を担保） ---
    // ★修正: ユニークなテストケース単位でカウント（複数実行の重複排除）
    const dailyAggregate: Record<string, DailyAggregateData> = {};

    // その日時点での、各テストケースの最新判定状態を追跡
    const testcaseStatusMap = new Map<string, {judgment: string, date: string}>();

    // ★修正: NG判定を受けたことのあるテストケースを追跡（不具合摘出数(実績)の累計用）
    const testcasesEverNg = new Set<string>();

    // ★優先順序: テスト結果の実施日範囲 > 試験予定期間
    let startDate: Date;
    let endDate: Date;

    // テスト結果の実施日範囲を取得（存在する場合）
    // ★大量データ対応: スプレッド演算子の代わりにループで最小値・最大値を取得（スタックオーバーフロー防止）
    let hasExecutionDates = false;
    let minTime = Infinity;
    let maxTime = -Infinity;

    historicalActivities.forEach(r => {
      if (r.execution_date) {
        hasExecutionDates = true;
        const time = new Date(r.execution_date).getTime();
        minTime = Math.min(minTime, time);
        maxTime = Math.max(maxTime, time);
      }
    });

    if (hasExecutionDates) {
      // テスト結果がある場合はその範囲を使用
      startDate = new Date(minTime);
      endDate = new Date(maxTime);
    } else {
      // テスト結果がない場合は試験予定期間を使用（フォールバック）
      startDate = testGroup.test_startdate ? new Date(testGroup.test_startdate) : new Date();
      endDate = testGroup.test_enddate ? new Date(testGroup.test_enddate) : new Date();
    }

    const today = new Date();
    // 終了日または今日のうち早い方まで集計する
    const maxDate = endDate < today ? endDate : today;

    // 日付をまたぐたびに、前日の累積値を保持するための変数
    let lastDateKey = '';

    // 開始日から最大日付までループし、日付の連続性を担保する
    for (let d = new Date(startDate); d <= maxDate; d.setDate(d.getDate() + 1)) {

      const dateKey = toJSTDateString(d);

      const todaysResults = historicalActivities.filter(r =>
        r.execution_date && toJSTDateString(r.execution_date) === dateKey
      );

      let dailyNgCount = 0;
      let dailyOkCount = 0;

      // この日の活動実績を処理（ユニークなテストケース単位で状態を更新）
      todaysResults.forEach((result) => {
        const key = `${result.tid}_${result.test_case_no}`;
        const existing = testcaseStatusMap.get(key);

        // より新しい実行結果で上書き
        // result.execution_dateはDate型またはstring型、existing.dateはstring型の日付（yyyy-mm-dd形式）
        // どちらも日付のみで比較できるよう、toJSTDateStringで揃える
        if (
          !existing ||
          toJSTDateString(result.execution_date!) >= toJSTDateString(new Date(existing.date))
        ) {
          // ★修正: NG判定を記録（NG判定を受けたテストケースは「不具合摘出数」に累計される）
          if (result.judgment === 'NG') {
            testcasesEverNg.add(key);
          }

          testcaseStatusMap.set(key, { judgment: result.judgment!, date: dateKey });

          // 状態遷移をカウント（前日との差分）
          if (existing) {
            // 以前の判定
            if (existing.judgment === 'OK' || existing.judgment === '参照OK') {
              // 前日はOKだったが、今日NGに変わった場合はNG増加
              if (result.judgment === 'NG') {
                dailyNgCount += 1;
              }
            } else if (existing.judgment === 'NG') {
              // 前日NGだったが、今日OKに修正された場合はOK増加
              if (result.judgment === 'OK' || result.judgment === '参照OK') {
                dailyOkCount += 1;
              }
            } else {
              // 前日は未実施だった
              if (result.judgment === 'OK' || result.judgment === '参照OK') {
                dailyOkCount += 1;
              } else if (result.judgment === 'NG') {
                dailyNgCount += 1;
              }
            }
          } else {
            // 初めての実行
            if (result.judgment === 'OK' || result.judgment === '参照OK') {
              dailyOkCount += 1;
            } else if (result.judgment === 'NG') {
              dailyNgCount += 1;
            }
          }
        }
      });

      // その日時点での累計OK数を計算
      let cumulativeOk = 0;
      testcaseStatusMap.forEach(status => {
        if (status.judgment === 'OK' || status.judgment === '参照OK') {
          cumulativeOk += 1;
        }
      });

      // ★修正: 不具合摘出数(実績) = NG判定を受けたことのあるテストケース数（累計）
      // この日時点までにNG判定を受けたことのあるテストケース数
      const cumulativeNg = testcasesEverNg.size;

      // その日時点での未解決不具合数（日毎の最新試験結果がNGとなっている件数）
      let unresolvedNgCount = 0;
      testcaseStatusMap.forEach(status => {
        if (status.judgment === 'NG') {
          unresolvedNgCount += 1;
        }
      });

      // 集計データを格納（実績がない日も前日の累積値を引き継ぐ）
      dailyAggregate[dateKey] = {
        ngCount: dailyNgCount,
        cumulativeOkCount: cumulativeOk,
        cumulativeNgCount: cumulativeNg,
        unresolvedNgCount: unresolvedNgCount,
      };

      lastDateKey = dateKey;
    }


    // --- 5. 予測曲線と最終データの計算 ---
    const totalTestDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const ngPlanCount = testGroup.ng_plan_count || 0;

    const dailyReportData = Object.entries(dailyAggregate).map(([dateKey, data]) => {
      const currentDate = new Date(dateKey);
      const elapsedDays = Math.max(1, Math.ceil((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Formula parameters (S-Curve)
      const lambda = 0.35 * (31 / totalTestDays); // マジックナンバーだが、元のロジックを維持
      const expTerm = Math.exp(-lambda * elapsedDays);

      // 予測曲線: テスト残件数(予測)
      // $$ \text{PredictedRemaining} = \text{Total} - \text{Total} \times \frac{1 - e^{-\lambda \cdot \text{ElapsedDays}}}{1 + 100 \cdot e^{-\lambda \cdot \text{ElapsedDays}}} $$ 
      const predictedRemainingTests = totalTestItems - (totalTestItems * (1 - expTerm) / (1 + 100 * expTerm));

      // 実績: テスト残件数(実績) = 総項目数 - その日までの累計OK数（マイナス防止）
      const actualRemainingTests = Math.max(0, totalTestItems - data.cumulativeOkCount);

      // 予測曲線: 不具合摘出数(予測)
      const predictedDefects = ngPlanCount * (1 - expTerm) / (1 + 100 * expTerm);

      // 実績: 不具合摘出数(実績) = その日までの累計NG数
      const actualDefects = data.cumulativeNgCount;

      return {
        execution_date: dateKey,
        ng_count: data.ngCount,
        predicted_remaining_tests: predictedRemainingTests,
        actual_remaining_tests: actualRemainingTests,
        predicted_defects: predictedDefects,
        actual_defects: actualDefects,
        // ★修正: 日毎の最新試験結果がNGとなっている件数（その日時点での値）
        unresolved_defects: data.unresolvedNgCount,
        test_startdate: testGroup.test_startdate,
        test_enddate: testGroup.test_enddate,
        ng_plan_count: ngPlanCount,
      };
    });

    // (ロギングと成功レスポンスは省略せず維持)
    statusCode = 200;
    // logAPIEndpoint({ /* ... */ });

    return NextResponse.json({
      success: true,
      data: dailyReportData,
    });
  } catch (error) {
    // (エラーハンドリングは省略せず維持)
    const isUnauthorized = error instanceof Error && error.message === 'Unauthorized';
    statusCode = isUnauthorized ? 401 : 500;
    // logAPIEndpoint({ /* ... */ });

    if (isUnauthorized) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      );
    }

    console.error('GET /api/test-groups/[groupId]/daily-report-data error:', error);
    return NextResponse.json(
      { success: false, error: '日時レポートデータの取得に失敗しました' },
      { status: 500 }
    );
  }
}