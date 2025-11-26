import * as React from 'react';
import { cn } from '@/utils/utils';

interface Label {
  name: string;
  type: 'text';
}

interface ImportInfoViewProps {
  labels: { [key: string]: Label };
  values: { [key: string]: string };
}

/**
 * ImportInfoViewコンポーネント
 * 
 * 各ラベルとその値を表示し、各列ごとに見やすい罫線を引きます。
 */
const ImportInfoView: React.FC<ImportInfoViewProps> = ({ labels, values }) => {
  return (
    <div className="relative w-2/3 overflow-x-auto bg-white rounded shadow">
      <table className={cn('w-full caption-bottom text-sm border-collapse')}>
        <tbody>
          {Object.keys(labels).map((key) => (
            <tr key={key} className="border-b">
              <th className="text-foreground h-10 px-2 text-right align-middle font-medium whitespace-pre-wrap border-r bg-gray-100" style={{ width: '20%' }}>
                {labels[key].name}
              </th>
              <td className="p-2 align-middle whitespace-pre-wrap">
                {values[key] ? (
                  values[key].split('\n').map((line, index) => (
                    <React.Fragment key={index}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))
                ) : (
                  <span></span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ImportInfoView;