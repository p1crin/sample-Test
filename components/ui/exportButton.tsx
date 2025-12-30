import clientLogger from '@/utils/client-logger';
import { formatDateTimeToTimestamp } from '@/utils/date-formatter';
import { Button } from "./button";

export default function ExportButton() {
  const exportCsv = async () => {
    try {
      clientLogger.debug('ユーザ一覧画面', 'エクスポート処理開始');
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
    } catch (error) {
      if (error instanceof Error) {
        clientLogger.error('ユーザ一覧画面', 'エクスポート処理失敗', { error: error.message });
      }
    }
  };

  return (
    <Button onClick={exportCsv}>
      エクスポート
    </Button >
  );
}