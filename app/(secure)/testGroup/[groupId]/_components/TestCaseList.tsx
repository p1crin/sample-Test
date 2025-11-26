import { TestCaseListRow } from './types/testCase-list-row';
import { DataGrid, Column } from '@/components/datagrid/DataGrid';
import CustomBarChart from '@/components/ui/chartBar';

type Dataset = {
  label: string;
  data: number[];
  originalData: number[];
  backgroundColor: string;
  isFirst?: boolean;
  isLast?: boolean;
};

type TestCaseListProps = {
  items: TestCaseListRow[];
  columns: Column<TestCaseListRow>[];
  sortConfig: { key: keyof TestCaseListRow; direction: 'asc' | 'desc' } | null;
  page: number;
  pageCount: number;
  onSort: (key: keyof TestCaseListRow) => void;
  onPageChange: (page: number) => void;
  renderActions?: (item: TestCaseListRow) => React.ReactNode;
};

function setIsFirst(datasets: Dataset[]): void {
  for (let i = 0; i < datasets.length; i++) {
    if (datasets[i].originalData[0] > 0) {
      datasets[i].isFirst = true;
      break;
    }
  }
}

function setIsLast(datasets: Dataset[]): void {
  for (let i = datasets.length - 1; i >= 0; i--) {
    if (datasets[i].originalData[0] > 0) {
      datasets[i].isLast = true;
      break;
    }
  }
}

export function TestCaseList({
  items,
  columns,
  sortConfig,
  page,
  pageCount,
  onSort,
  onPageChange,
  renderActions,
}: TestCaseListProps) {
  return (
    <section>
      <DataGrid
        items={items}
        columns={[
          ...columns,
          {
            key: 'chartData',
            header: '進捗',
            render: (_value: unknown, row: TestCaseListRow) => {
              const total = row.chartData.notStartCount + row.chartData.okCount + row.chartData.ngCount + row.chartData.excludedCount;
              const datasets: Dataset[] = [
                {
                  label: '未実施',
                  data: [(row.chartData.notStartCount / total) * 100],
                  originalData: [row.chartData.notStartCount],
                  backgroundColor: 'orange',
                },
                {
                  label: 'OK',
                  data: [(row.chartData.okCount / total) * 100],
                  originalData: [row.chartData.okCount],
                  backgroundColor: '#0068b7',
                },
                {
                  label: 'NG',
                  data: [(row.chartData.ngCount / total) * 100],
                  originalData: [row.chartData.ngCount],
                  backgroundColor: 'red',
                },
                {
                  label: '対象外',
                  data: [(row.chartData.excludedCount / total) * 100],
                  originalData: [row.chartData.excludedCount],
                  backgroundColor: 'gray',
                },
              ];

              // ステータスバーの最初と最後の項目の判定
              setIsFirst(datasets);
              setIsLast(datasets);

              return (
                <div style={{ width: '250px', height: '36px' }}>
                  <CustomBarChart datasets={datasets} />
                </div>
              );
            },
          },
        ]}
        sortConfig={sortConfig}
        onSort={onSort}
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        renderActions={renderActions}
      />
    </section>
  );
}