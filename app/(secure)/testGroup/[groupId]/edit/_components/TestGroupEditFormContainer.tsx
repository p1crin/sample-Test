'use client';
import Loading from '@/components/ui/loading';
import { TestRole } from '@/types/database';
import { fetchData } from '@/utils/api';
import clientLogger from '@/utils/client-logger';
import { formatDateWithHyphen } from '@/utils/date-formatter';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { TestGroupEditFormState } from './TestGroupEditForm';
import { TestGroupEditForm } from './TestGroupEditForm';

export function TestGroupEditFormContainer() {

  const [editLoading, setEditLoading] = useState(true);
  const params = useParams();
  const groupId = params.groupId;

  const [formData, setFormData] = useState({
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

  useEffect(() => {
    const getFormFunc = async () => {
      try {
        setEditLoading(true);
        const testGroupEditData = await fetchData(`/api/test-groups/${groupId}`);
        const getEditData = testGroupEditData.data;
        const tags = getEditData.tags; //タグの配列

        if (!testGroupEditData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${testGroupEditData.error})`);
        }

        const designers: string[] = [];
        const ececuters: string[] = [];
        const viewers: string[] = [];
        // タグの振り分け
        if (tags && tags.length > 0) {
          for (const tag of tags) {
            switch (tag.test_role) {
              case TestRole.DESIGNER:
                designers.push(tag.tag_name);
                break;
              case TestRole.EXECUTOR:
                ececuters.push(tag.tag_name);
                break;
              case TestRole.VIEWER:
                viewers.push(tag.tag_name);
                break;
              default:
                break;
            }
          }
        }

        const formingEdit: TestGroupEditFormState = {
          oem: getEditData.oem,
          model: getEditData.model,
          event: getEditData.event,
          variation: getEditData.variation,
          destination: getEditData.destination,
          specs: getEditData.specs,
          test_startdate: formatDateWithHyphen(getEditData.test_startdate),
          test_enddate: formatDateWithHyphen(getEditData.test_enddate),
          ngPlanCount: getEditData.ng_plan_count.toString(),
          designerTag: designers,
          executerTag: ececuters,
          viewerTag: viewers,
        }
        setFormData(formingEdit);
      } catch (err) {
        clientLogger.error('TestGroupEditFormContainer', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setEditLoading(false);
      }
    };
    getFormFunc();
  }, []); // 空の依存配列で、マウント時に一度だけ実行

  return (
    <>
      {/* テストグループデータ読み込み中の表示 */}
      <Loading
        isLoading={editLoading}
        message="データ読み込み中..."
        size="md"
      />

      {!editLoading && (
        <TestGroupEditForm
          form={formData}
        />
      )}
    </>
  );
}
