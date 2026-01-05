'use client';

import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { apiGet } from '@/utils/apiClient';

// Chart.jsプラグインを登録
// バーチャート、折れ線グラフ、グリッド等の描画に必要
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/**
 * 日別試験実施数レポートのデータ型
 * APIから返される日毎の集計データ
 */
interface DailyReportData {
  execution_date: string; // YYYY-MM-DD形式の実行日付
  daily_defect_count: number; // その日の不具合摘出数（Daily）
  predicted_remaining_tests: number; // テスト残件数(予測)
  actual_remaining_tests: number; // テスト残件数(実績)
  predicted_defects: number; // 不具合摘出数(予測)
  actual_defects: number; // 不具合摘出数(実績) - NG判定を受けたことのあるテストケース数の累計
  unresolved_defects: number; // 未解決不具合数 - その日時点で最新判定がNGのテストケース数
  test_startdate: string | null;
  test_enddate: string | null;
  ng_plan_count: number; // NG計画数
}

/**
 * TestSummaryResultGraphのプロパティ型
 */
interface TestSummaryResultGraphProps {
  groupId: number; // テストグループID
}

export default function TestSummaryResultGraph({ groupId }: TestSummaryResultGraphProps) {
  const [data, setData] = useState<DailyReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * グループIDが変更されたときに、日別レポートデータを取得
   * APIから返されたデータを日付順でソートして表示
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // API: /app/api/test-groups/[groupId]/daily-report-data/route.ts
        // 返却データ: 日毎の試験実施数、NG数、テスト残件数、不具合数等の集計
        const result = await apiGet<{ success: boolean; error?: string; data: DailyReportData[] }>(
          `/api/test-groups/${groupId}/daily-report-data`
        );

        if (!result.success) {
          throw new Error(result.error || 'データの取得に失敗しました');
        }

        // 日付順でソート（古い順）
        // グラフXの時系列表示のため必須
        const sortedData = [...result.data].sort(
          (a, b) => new Date(a.execution_date).getTime() - new Date(b.execution_date).getTime()
        );

        setData(sortedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId]);

  if (loading) {
    return (
      <>
        <h1 className="text-2xl font-bold mt-4 pb-3">日別試験実施数</h1>
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 className="text-2xl font-bold mt-4 pb-3">日別試験実施数</h1>
        <div className="flex justify-center items-center h-96 text-red-500">
          {error}
        </div>
      </>
    );
  }

  if (data.length === 0) {
    return (
      <>
        <h1 className="text-2xl font-bold mt-4 pb-3">日別試験実施数</h1>
        <div className="flex justify-center items-center h-96 text-gray-500">
          データがありません
        </div>
      </>
    );
  }

  /**
   * グラフ表示用の日付ラベル（M/D形式）
   * 例: 1/5, 1/6, 1/7...
   */
  const labels = data.map((d) => {
    const date = new Date(d.execution_date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  /**
   * Chart.jsチャートデータの定義
   * 複合グラフ：棒グラフ + 複数の折れ線グラフ
   * Y軸は2つを使用：
   *   - y（左）：テスト残件数（0-300）
   *   - y1（右）：不具合数・NG数（0-30）
   */
  const chartData: ChartData<'bar' | 'line'> = {
    labels,
    datasets: [
      /**
       * NG数（棒グラフ）
       * - 右Y軸（y1）を使用
       * - order: 6（最奥に配置 = 他の線の背後に表示）
       * - 色：深緑
       */
      {
        type: 'bar' as const,
        label: 'NG数',
        data: data.map((d) => d.daily_defect_count),
        backgroundColor: 'rgba(34, 85, 34, 0.9)',
        borderColor: 'rgba(34, 85, 34, 1)',
        borderWidth: 1,
        yAxisID: 'y1',
        order: 6,
      },
      /**
       * テスト残件数(予測)
       * - S曲線モデルで計算した予測値
       * - 左Y軸（y）を使用
       * - order: 1（最も手前に配置）
       * - 色：紫
       */
      {
        type: 'line' as const,
        label: 'テスト残件数(予測)',
        data: data.map((d) => d.predicted_remaining_tests),
        borderColor: 'rgb(180, 82, 180)',
        backgroundColor: 'rgb(180, 82, 180)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: 'rgb(180, 82, 180)',
        tension: 0.1,
        yAxisID: 'y',
        order: 1,
      },
      /**
       * テスト残件数(実績)
       * - 実際の試験実施結果から計算
       * - 計算式：総テスト数 - その日までの累計OK数
       * - 左Y軸（y）を使用
       * - order: 2
       * - 色：青
       */
      {
        type: 'line' as const,
        label: 'テスト残件数(実績)',
        data: data.map((d) => d.actual_remaining_tests),
        borderColor: 'rgb(31, 119, 180)',
        backgroundColor: 'rgb(31, 119, 180)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: 'rgb(31, 119, 180)',
        tension: 0.1,
        yAxisID: 'y',
        order: 2,
      },
      /**
       * 不具合摘出数(実績)
       * - 定義：NG判定を受けたことのあるテストケース数の累計
       * - 特性：単調増加（修正済みのテストも含める）
       * - 右Y軸（y1）を使用
       * - order: 3
       * - 色：オレンジ
       */
      {
        type: 'line' as const,
        label: '不具合摘出数(実績)',
        data: data.map((d) => d.actual_defects),
        borderColor: 'rgb(255, 127, 14)',
        backgroundColor: 'rgb(255, 127, 14)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: 'rgb(255, 127, 14)',
        tension: 0.1,
        yAxisID: 'y1',
        order: 3,
      },
      /**
       * 未解決不具合数
       * - 定義：その日時点で最新判定がNG状態のテストケース数
       * - 特性：修正されたテストケースは除外、変動する
       * - 右Y軸（y1）を使用
       * - order: 4
       * - 色：緑（線を太くして視認性向上）
       * - ポイント：白い円形で強調
       */
      {
        type: 'line' as const,
        label: '未解決不具合数',
        data: data.map((d) => d.unresolved_defects),
        borderColor: 'rgb(44, 160, 44)',
        backgroundColor: 'transparent',
        borderWidth: 3, // 他の線より太く表示
        pointRadius: 5, // ポイントを大きく表示
        pointBorderWidth: 2,
        pointBorderColor: 'rgb(44, 160, 44)',
        pointBackgroundColor: 'rgb(255, 255, 255)', // 白い背景
        fill: false,
        tension: 0.1,
        yAxisID: 'y1',
        order: 4,
      },
      /**
       * 不具合摘出数(予測)
       * - S曲線モデルで計算した予測値
       * - 右Y軸（y1）を使用
       * - order: 5
       * - 色：シアン/ティール
       */
      {
        type: 'line' as const,
        label: '不具合摘出数(予測)',
        data: data.map((d) => d.predicted_defects),
        borderColor: 'rgb(23, 190, 207)',
        backgroundColor: 'rgb(23, 190, 207)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: 'rgb(23, 190, 207)',
        tension: 0.1,
        yAxisID: 'y1',
        order: 5,
      },
    ],
  };

  /**
   * Chart.jsのチャート設定オプション
   * グラフの表示方法、Y軸、ツールチップなどを定義
   */
  const options: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const, // X軸上のすべてのデータセットをハイライト
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true, // 四角ではなく円形のポイントを凡例に表示
          padding: 20,
          font: {
            size: 12,
          },
        },
      },
      /**
       * ツールチップのカスタマイズ
       * 予測値（予測という文字を含む）は小数第1位まで表示
       * 実績値（NG数など）は整数で表示
       */
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            // 予測値と実績値で表示精度を変更
            const displayValue = label.includes('予測')
              ? value?.toFixed(1) // 予測値：小数第1位
              : Math.round(value ?? 0); // 実績値：整数
            return `${label}: ${displayValue}`;
          },
        },
      },
    },
    scales: {
      /**
       * X軸の設定
       * 日付を表示（M/D形式）
       */
      x: {
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          maxRotation: 45, // ラベルの回転角度
          minRotation: 0,
        },
      },
      /**
       * 左Y軸（y）の設定
       * テスト残件数の表示用（範囲：0-300程度）
       * 複合グラフなので複数の値を1つの軸で管理
       */
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: false,
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
        min: 0,
        ticks: {
          stepSize: 50, // 50単位のグリッドラインを表示
        },
      },
      /**
       * 右Y軸（y1）の設定
       * 不具合数・NG数の表示用（範囲：0-30程度）
       * drawOnChartArea: false で、グリッドラインが左軸と重複しないようにする
       */
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: false,
        },
        grid: {
          drawOnChartArea: false, // 右Y軸のグリッドラインをチャート背景に描画しない
        },
        min: 0,
        ticks: {
          stepSize: 5, // 5単位で目盛りを表示
        },
      },
    },
  };

  return (
    <>
      <h1 className="text-2xl font-bold mt-4 pb-3">日別試験実施数</h1>
      <div className="flex justify-center items-center">
        {/* グラフコンテナ */}
        {/* 高さ750px で複合グラフを描画 */}
        {/* Chart.js + react-chartjs-2 で実装 */}
        <div className="w-full" style={{ height: '750px' }}>
          <Chart type="bar" data={chartData} options={options} />
        </div>
      </div>
    </>
  );
}