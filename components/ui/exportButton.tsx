import clientLogger from '@/utils/client-logger';
import { formatDateTimeToTimestamp } from '@/utils/date-formatter';
import { Button } from "./button";

interface ExportButtonProps {
  onError: (error: Error) => void;
}

export default function ExportButton({ onError }: ExportButtonProps) {

  const exportCsv = async () => {
    try {
      clientLogger.debug('ユーザ一覧画面', 'エクスポート処理開始');
      
      // response.text();の形でほしいのでfetchを使用する
      const response = await fetch('/api/users/export', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const csvContent = await response.text();
      // 先頭に'\uFEFF'を付けてBOM付にする
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ユーザ情報ファイル_${formatDateTimeToTimestamp(new Date().toISOString())}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      clientLogger.debug('ユーザ一覧画面', 'エクスポート処理成功');
    } catch (err) {
      clientLogger.error('ユーザ一覧画面', 'エクスポート処理失敗', { error: err instanceof Error ? err.message : String(err) });
      onError(err as Error);
    }
  };

  return (
    <Button onClick={exportCsv}>
      エクスポート
    </Button >
  );
}