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
              const total = row.chartData.not_started_items + row.chartData.ok_items + row.chartData.ng_items + row.chartData.excluded_items;

              const notStartedPercentage = (row.chartData.not_started_items / total) * 100;
              const okPercentage = (row.chartData.ok_items / total) * 100;
              const ngPercentage = (row.chartData.ng_items / total) * 100;
              const excludedPercentage = (row.chartData.excluded_items / total) * 100;

              const percentages = [notStartedPercentage, okPercentage, ngPercentage, excludedPercentage];
              const roundedPercentages = percentages.map(Math.round);
              const totalRounded = roundedPercentages.reduce((acc, val) => acc + val, 0);

              if (totalRounded !== 100) {
                const maxIndex = roundedPercentages.indexOf(Math.max(...roundedPercentages));
                roundedPercentages[maxIndex] += 100 - totalRounded;
              }

              const datasets: Dataset[] = [
                {
                  label: '未実施',
                  data: [roundedPercentages[0]],
                  originalData: [row.chartData.not_started_items],
                  backgroundColor: 'orange',
                },
                {
                  label: 'OK',
                  data: [roundedPercentages[1]],
                  originalData: [row.chartData.ok_items],
                  backgroundColor: '#0068b7',
                },
                {
                  label: 'NG',
                  data: [roundedPercentages[2]],
                  originalData: [row.chartData.ng_items],
                  backgroundColor: 'red',
                },
                {
                  label: '対象外',
                  data: [roundedPercentages[3]],
                  originalData: [row.chartData.excluded_items],
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