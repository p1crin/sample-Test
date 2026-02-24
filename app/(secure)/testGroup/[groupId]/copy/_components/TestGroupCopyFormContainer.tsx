'use client';
import Loading from '@/components/ui/loading';
import { TestRole } from '@/types/database';
import { apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { formatDateWithHyphen } from '@/utils/date-formatter';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { TestGroupCopyFormState } from './TestGroupCopyForm';
import { TestGroupCopyForm } from './TestGroupCopyForm';

export function TestGroupCopyFormContainer() {
  const [copyLoading, setCopyLoading] = useState(true);
  const [form, setForm] = useState<TestGroupCopyFormState>({
    oem: '',
    model: '',
    event: '',
    variation: '',
    destination: '',
    specs: '',
    test_startdate: '',
    test_enddate: '',
    ngPlanCount: '',
    designerTag: [] as string[],
    executerTag: [] as string[],
    viewerTag: [] as string[],
  });
  const [apiError, setApiError] = useState<Error | null>(null);
  if (apiError) throw apiError;

  const params = useParams();
  const groupId = params.groupId;

  useEffect(() => {
    const getTestGroupCopyDataFunc = async () => {
      setCopyLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const testGroupCopyData = await apiGet<any>(`/api/test-groups/${groupId}`);
        const getCopyData = testGroupCopyData.data;
        const tags = getCopyData.tags; //タグの配列

        if (!testGroupCopyData.success || !testGroupCopyData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${testGroupCopyData.error})`);
        }

        const designers: string[] = [];
        const executers: string[] = [];
        const viewers: string[] = [];
        // タグの振り分け
        if (tags && tags.length > 0) {
          for (const tag of tags) {
            switch (tag.test_role) {
              case TestRole.DESIGNER:
                designers.push(tag.tag_name);
                break;
              case TestRole.EXECUTOR:
                executers.push(tag.tag_name);
                break;
              case TestRole.VIEWER:
                viewers.push(tag.tag_name);
                break;
              default:
                break;
            }
          }
        }

        const formatCopy: TestGroupCopyFormState = {
          oem: getCopyData.oem,
          model: getCopyData.model,
          event: getCopyData.event,
          variation: getCopyData.variation,
          destination: getCopyData.destination,
          specs: getCopyData.specs,
          test_startdate: formatDateWithHyphen(getCopyData.test_startdate),
          test_enddate: formatDateWithHyphen(getCopyData.test_enddate),
          ngPlanCount: getCopyData.ng_plan_count.toString(),
          designerTag: designers,
          executerTag: executers,
          viewerTag: viewers
        }
        setForm(formatCopy);

        clientLogger.info('テストグループ複製画面', 'データ取得成功', { testGroupId: getCopyData.id });
      } catch (err) {
        clientLogger.error('テストグループ複製画面', 'データ取得失敗', { error: err instanceof Error ? err.message : String(err) });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setCopyLoading(false);
      }
    };
    getTestGroupCopyDataFunc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空の依存配列で、マウント時に一度だけ実行

  return (
    <>
      {/* テストグループデータ読み込み中の表示 */}
      <Loading
        isLoading={copyLoading}
        message="データ読み込み中..."
        size="md"
      />
      {!copyLoading && (
        <TestGroupCopyForm
          form={form}
        />
      )}
    </>
  );
}
