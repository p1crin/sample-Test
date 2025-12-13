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

interface DailyReportData {
  execution_date: string;
  ng_count: number;
  predicted_remaining_tests: number;
  actual_remaining_tests: number;
  predicted_defects: number;
  actual_defects: number;
  unresolved_defects: number;
  test_startdate: string | null;
  test_enddate: string | null;
  ng_plan_count: number;
}

interface TestSummaryResultGraphProps {
  groupId: number;
}

export default function TestSummaryResultGraph({ groupId }: TestSummaryResultGraphProps) {
  const [data, setData] = useState<DailyReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/test-groups/${groupId}/daily-report-data`);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'データの取得に失敗しました');
        }

        // Sort by execution_date
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

  // Format date labels (M/D format)
  const labels = data.map((d) => {
    const date = new Date(d.execution_date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  const chartData: ChartData<'bar' | 'line'> = {
    labels,
    datasets: [
      // Bar chart for NG数 (uses right Y-axis)
      {
        type: 'bar' as const,
        label: 'NG数',
        data: data.map((d) => d.ng_count),
        backgroundColor: 'rgba(34, 85, 34, 0.9)',
        borderColor: 'rgba(34, 85, 34, 1)',
        borderWidth: 1,
        yAxisID: 'y1',
        order: 6, // Render bars behind lines
      },
      // テスト残件数(予測) - Purple/Magenta line
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
      // テスト残件数(実績) - Blue line
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
      // 不具合摘出数(実績) - Orange line
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
      // 未解決不具合数 - Green line
      {
        type: 'line' as const,
        label: '未解決不具合数',
        data: data.map((d) => d.unresolved_defects),
        borderColor: 'rgb(44, 160, 44)',
        backgroundColor: 'rgb(44, 160, 44)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: 'rgb(44, 160, 44)',
        tension: 0.1,
        yAxisID: 'y1',
        order: 4,
      },
      // 不具合摘出数(予測) - Cyan/Teal line
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

  const options: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            // Round to 1 decimal for predicted values
            const displayValue = label.includes('予測')
              ? value?.toFixed(1)
              : Math.round(value??0);
            return `${label}: ${displayValue}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0,
        },
      },
      // Left Y-axis: テスト残件数 (0-300 range based on your chart)
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
          stepSize: 50,
        },
      },
      // Right Y-axis: 不具合数/NG数 (0-30 range based on your chart)
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: false,
        },
        grid: {
          drawOnChartArea: false,
        },
        min: 0,
        ticks: {
          stepSize: 5,
        },
      },
    },
  };

  return (
    <>
      <h1 className="text-2xl font-bold mt-4 pb-3">日別試験実施数</h1>
      <div className="flex justify-center items-center">
        <div className="w-full" style={{ height: '500px' }}>
          <Chart type="bar" data={chartData} options={options} />
        </div>
      </div>
    </>
  );
}
