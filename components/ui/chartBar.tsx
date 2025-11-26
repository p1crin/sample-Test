import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend, ScriptableContext, TooltipItem } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type CustomBarDataset = {
  label: string;
  data: number[];
  originalData: number[];
  backgroundColor: string;
  isFirst?: boolean;
  isLast?: boolean;
};

type ChartBarProps = {
  datasets: CustomBarDataset[];
};

const ChartBar = ({ datasets }: ChartBarProps) => {
  const options = {
    indexAxis: 'y' as const,
    elements: {
      bar: {
        borderWidth: 1,
        borderRadius: (context: ScriptableContext<'bar'>) => {
          const { isFirst, isLast } = context.dataset as CustomBarDataset;
          return {
            topLeft: isFirst ? 5 : 0,
            bottomLeft: isFirst ? 5 : 0,
            topRight: isLast ? 5 : 0,
            bottomRight: isLast ? 5 : 0,
          };
        },
        borderSkipped: false,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: function (context: TooltipItem<'bar'>) {
            const label = context.dataset.label || '';
            const value = context.raw as number;
            const originalValue = (context.dataset as CustomBarDataset).originalData[context.dataIndex] as number;
            return `${label}: ${originalValue}件 (${value.toFixed(0)}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        display: false,
      },
      y: {
        stacked: true,
        display: false,
      },
    },
  };

  const data = {
    labels: [''],
    datasets: datasets,
  };

  return <Bar data={data} options={options} />;
};

export default ChartBar;