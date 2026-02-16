'use client';
import { Button } from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import { JUDGMENT_OPTIONS, JudgmentOption } from '@/constants/constants';
import { STATUS_CODES } from '@/constants/statusCodes';
import { apiGet, apiPost, apiDelete } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TestCaseDetailRow } from '../../_components/types/testCase-detail-list-row';
import { TestCaseResultRow, TestResultsData } from '../../_components/types/testCase-result-list-row';
import { TestCaseConduct } from './TestCaseConduct';
import TestTable from './testTable';
import { Modal } from '@/components/ui/modal';
import { FileInfo, generateUniqueId } from '@/utils/fileUtils';

// 判定のバリデーションを行うための型ガード
const isValidJudgment = (value: unknown): value is JudgmentOption => {
  return typeof value === 'string' && Object.values(JUDGMENT_OPTIONS).includes(value as JudgmentOption);
};

// エビデンスデータをFileInfo配列に変換するヘルパー関数
const convertEvidenceToFileInfo = (evidence: unknown): FileInfo[] | null => {
  if (!evidence) return null;

  // 文字列の場合（カンマ区切りまたは単一パス）
  if (typeof evidence === 'string') {
    const paths = evidence.split(',').map(p => p.trim()).filter(Boolean);
    return paths.map(path => ({
      name: path.split('/').pop() || path,
      id: generateUniqueId(),
      path: path,
    }));
  }

  // 配列の場合
  if (Array.isArray(evidence)) {
    return evidence.map(item => {
      if (typeof item === 'string') {
        return {
          name: item.split('/').pop() || item,
          id: generateUniqueId(),
          path: item,
        };
      }
      // すでにFileInfo形式の場合
      return item;
    });
  }

  return null;
};

const labels = {
  tid: { name: "TID", type: "text" as 'text' },
  firstLayer: { name: "第1層", type: "text" as 'text' },
  secondLayer: { name: "第2層", type: "text" as 'text' },
  thirdLayer: { name: "第3層", type: "text" as 'text' },
  fourthLayer: { name: "第4層", type: "text" as 'text' },
  purpose: { name: "目的", type: "text" as 'text' },
  checkItems: { name: "確認観点", type: "text" as 'text' },
  requestId: { name: "要求ID", type: "text" as 'text' },
  controlSpec: { name: "制御仕様", type: "img" as 'img' },
  dataFlow: { name: "データフロー", type: "img" as 'img' },
  testProcedure: { name: "テスト手順", type: "text" as 'text' }
};

export function TestCaseConductContainer({ groupId, tid }: { groupId: number; tid: string }) {
  const [data, setData] = useState<TestCaseDetailRow | null>(null);
  const [initialTestCaseData, setInitialTestCaseData] = useState<TestCaseResultRow[]>([]);
  const [pastTestCaseData, setPastTestCaseData] = useState<TestCaseResultRow[][]>([]);
  const [labelData, setLabelData] = useState(labels);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewTestCaseConduct, setShowNewTestCaseConduct] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [apiError, setApiError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resultsWithHistory, setResultsWithHistory] = useState<TestResultsData>({});
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [executorsList, setExecutorsList] = useState<Array<{ id: number; name: string; }>>([]);
  const [executorsPerRow, setExecutorsPerRow] = useState<Record<string, Array<{ id: number; name: string }>>>({});

  // 登録成功フラグ（タブクローズ時のクリーンアップ用）
  const isRegistrationSuccessful = useRef(false);
  // ナビゲーション中フラグ（クライアントサイドナビゲーション時のクリーンアップ用）
  const isNavigatingAway = useRef(false);
  // 初期エビデンスIDを記録（新規追加されたエビデンスのみを削除するため）
  const initialEvidenceIds = useRef<Map<string, Set<number>>>(new Map());
  // 初期エビデンスID記録済みフラグ
  const initialEvidenceIdsRecorded = useRef(false);

  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  if (apiError) throw apiError;

  useEffect(() => {
    // ユーザー情報がない場合は処理をスキップ
    if (!user) return;

    const fetchExecutors = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await apiGet<any>(`/api/test-groups/${groupId}/permitted-users`);
        const fetchedExecutors = result.data?.map((u: { id: number; name: string; }) => ({
          id: u.id,
          name: u.name,
        })) || [];

        setExecutorsList(fetchedExecutors);
        clientLogger.info('テスト結果登録画面', '実施者取得成功', { count: fetchedExecutors.length });
      } catch (err) {
        clientLogger.error('テスト結果登録画面', '実施者取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        // エラーの場合、少なくとも自分自身は選択できるようにする
        if (user) {
          const fallbackList = [{
            id: user.id,
            name: user.name,
          }];
          setExecutorsList(fallbackList);
        }
      }
    };

    const fetchTestCaseDetail = async () => {
      try {
        clientLogger.info('テストケース結果確認画面', 'テストケース詳細取得開始', { groupId, tid });

        const result = await apiGet<any>(`/api/test-groups/${groupId}/cases/${tid}`);
        if (!result || !result.success || !result.data || result.data.length === 0) {
          throw new Error('テストケース詳細の取得に失敗しました');
        }

        const testCase = result.data[0] as TestCaseDetailRow;
        setData(testCase);
        setLabelData(labels);

        clientLogger.info('テストケース結果確認画面', 'テストケース詳細取得成功', { tid });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        clientLogger.error('テストケース結果確認画面', 'テストケース詳細取得失敗', { error: errorMessage });
        setLoadError('テストケース詳細の取得に失敗しました');
        setApiError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    const fetchTestResults = async () => {
      try {
        clientLogger.info('テストケース結果確認画面', 'テスト結果取得開始', { groupId, tid });

        const data = await apiGet<any>(`/api/test-groups/${groupId}/cases/${tid}/results`);

        if (!data.success) {
          throw new Error(data.error || 'テスト結果の取得に失敗しました');
        }
        // resultsが無いときAPIエラー
        if (Object.keys(data.results).length === 0 || !data.results) {
          throw new Error(`${STATUS_CODES.NOT_FOUND}:テスト結果がありません`);
        }

        // 履歴付きの結果を保存
        const resultsData = data.results as TestResultsData;
        setResultsWithHistory(resultsData);
        // 初期のテストケースデータを設定
        const initialData = Object.values(resultsData).map((result) => ({
          ...result.latestValidResult,
          result: '',
          softwareVersion: '',
          hardwareVersion: '',
          comparatorVersion: '',
          executionDate: '',
          executor: '',
          evidence: null,
          note: '',
          judgment: result.latestValidResult.is_target === false ? JUDGMENT_OPTIONS.EXCLUDED : "未着手"
        })) as TestCaseResultRow[];
        const historyData = Object.values(resultsData).flatMap((result) =>
          result.allHistory.map((histItem) => ({
            historyCount: histItem.history_count,
            test_case_no: histItem.test_case_no,
            test_case: histItem.test_case,
            expected_value: histItem.expected_value,
            is_target: histItem.is_target,
            result: histItem.result || '',
            judgment: isValidJudgment(histItem.judgment) ? histItem.judgment : JUDGMENT_OPTIONS.EMPTY,
            softwareVersion: histItem.software_version || '',
            hardwareVersion: histItem.hardware_version || '',
            comparatorVersion: histItem.comparator_version || '',
            executionDate: histItem.execution_date || '',
            executor: histItem.executor || '',
            evidence: convertEvidenceToFileInfo(histItem.evidence),
            note: histItem.note || '',
          }))
        ) as TestCaseResultRow[];
        // historyCount毎にグルーピング
        const groupedHistoryData = historyData.reduce((acc, item) => {
          const historyCount = item.historyCount ?? 0; // historyCountがundefinedの場合は0を使用
          if (!acc[historyCount]) {
            acc[historyCount] = [];
          }
          acc[historyCount].push(item);
          return acc;
        }, [] as TestCaseResultRow[][])
          .filter(group => group.length > 0)
          .map(group =>
            // 各グループ内でindexを再設定
            group.map((item, idx) => ({
              ...item,
              index: idx + 1
            }))
          );

        // initialDataにhistoryCountとindexを追加（履歴数+1）
        const initialDataWithHistoryCount = initialData.map((item, idx) => ({
          ...item,
          index: idx + 1,
          historyCount: groupedHistoryData.length + 1
        })) as TestCaseResultRow[];
        setPastTestCaseData(groupedHistoryData)
        // 履歴がないかチェック
        const allHistoryCountsZero = Object.values(resultsData).every(result => result.historyCounts.length === 0);
        setShowNewTestCaseConduct(allHistoryCountsZero);
        setButtonDisabled(allHistoryCountsZero);
        setInitialTestCaseData(initialDataWithHistoryCount);

        // 行（test_case_no）×履歴回数（historyCount）ごとに過去の実施者を抽出する
        const perRowExecutors: Record<string, Array<{ id: number; name: string }>> = {};
        Object.entries(resultsData).forEach(([testCaseNoStr, result]) => {
          const testCaseNo = Number(testCaseNoStr);
          result.allHistory.forEach(histItem => {
            const executorName = (histItem.executor ?? '') as string;
            if (!executorName) return;
            const key = `${testCaseNo}_${histItem.history_count}`;
            const executor: { id: number; name: string } = {
              id: (histItem.executor_id ?? -Date.now() - Math.floor(Math.random() * 1000)) as number,
              name: executorName,
            };
            if (!perRowExecutors[key]) {
              perRowExecutors[key] = [];
            }
            // 名前で重複排除
            if (!perRowExecutors[key].some(e => e.name === executor.name)) {
              perRowExecutors[key].push(executor);
            }
          });
        });
        setExecutorsPerRow(perRowExecutors);

        clientLogger.info('テストケース結果確認画面', 'テスト結果取得成功', { tid, count: Object.keys(resultsData).length });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        clientLogger.error('テストケース結果確認画面', 'テスト結果取得失敗', { error: errorMessage });
        setLoadError('テスト結果の取得に失敗しました');
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    // 並列実行可能な処理をまとめる
    Promise.all([fetchExecutors(), fetchTestCaseDetail()]).then(() => {
      // テスト詳細取得後にテスト結果を取得
      fetchTestResults();
    });
  }, [groupId, tid, user]);

  // 初期エビデンスIDを記録（新規追加されたエビデンスのみを削除するため）
  // 注意: 初回ロード時のみ記録し、その後の変更では更新しない
  useEffect(() => {
    // 既に記録済みの場合はスキップ
    if (initialEvidenceIdsRecorded.current) return;

    // データがまだロードされていない場合はスキップ
    if (initialTestCaseData.length === 0 && pastTestCaseData.length === 0) return;

    // 新規入力データのエビデンスIDを記録
    initialTestCaseData.forEach((item) => {
      const key = `new_${item.test_case_no}`;
      const evidenceIds = new Set<number>();

      item.evidence?.forEach((file) => {
        if (file.fileNo !== undefined) {
          evidenceIds.add(file.fileNo);
        }
      });

      initialEvidenceIds.current.set(key, evidenceIds);
    });

    // 履歴データのエビデンスIDを記録
    pastTestCaseData.forEach((historyData, historyIndex) => {
      historyData.forEach((item) => {
        const key = `history_${historyIndex + 1}_${item.test_case_no}`;
        const evidenceIds = new Set<number>();

        item.evidence?.forEach((file) => {
          if (file.fileNo !== undefined) {
            evidenceIds.add(file.fileNo);
          }
        });

        initialEvidenceIds.current.set(key, evidenceIds);
      });
    });

    // 記録済みフラグを立てる
    initialEvidenceIdsRecorded.current = true;
    clientLogger.info('テスト結果登録画面', '初期エビデンスID記録完了', {
      keys: Array.from(initialEvidenceIds.current.keys()),
      counts: Array.from(initialEvidenceIds.current.entries()).map(([k, v]) => ({ key: k, count: v.size }))
    });
  }, [initialTestCaseData, pastTestCaseData]);

  // 新規追加されたエビデンスを削除するクリーンアップ関数
  const cleanupNewEvidences = useCallback(async (useKeepalive: boolean = false): Promise<void> => {
    clientLogger.info('テスト結果登録画面', 'クリーンアップ開始', {
      useKeepalive,
      isRegistrationSuccessful: isRegistrationSuccessful.current,
      initialEvidenceIdsRecorded: initialEvidenceIdsRecorded.current,
    });

    // 登録が成功している場合はクリーンアップ不要
    if (isRegistrationSuccessful.current) {
      clientLogger.info('テスト結果登録画面', 'クリーンアップスキップ（登録成功済み）');
      return;
    }

    const deletePromises: Promise<void>[] = [];

    const deleteEvidence = (testCaseNo: number, historyCount: number, fileNo: number): Promise<void> => {
      return fetch('/api/files/evidences', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testGroupId: groupId,
          tid: tid,
          testCaseNo: testCaseNo,
          historyCount: historyCount,
          fileNo: fileNo,
        }),
        keepalive: useKeepalive,
      }).then(() => {
        clientLogger.info('テスト結果登録画面', 'エビデンス削除成功', { testCaseNo, historyCount, fileNo });
      }).catch((err) => {
        if (!useKeepalive) {
          clientLogger.error('テスト結果登録画面', 'エビデンス削除失敗', { error: err });
        }
        // keepaliveの場合はページがアンロードされるためエラーは無視
      });
    };

    // 新規入力データから新規追加されたエビデンスを削除
    initialTestCaseData.forEach((item) => {
      const key = `new_${item.test_case_no}`;
      const initialIds = initialEvidenceIds.current.get(key) || new Set<number>();

      clientLogger.info('テスト結果登録画面', 'エビデンスチェック（新規）', {
        key,
        initialIds: Array.from(initialIds),
        currentEvidence: item.evidence?.map(f => ({ fileNo: f.fileNo, name: f.name })) || [],
      });

      item.evidence?.forEach((file) => {
        if (file.fileNo !== undefined && !initialIds.has(file.fileNo)) {
          clientLogger.info('テスト結果登録画面', '削除対象エビデンス検出', {
            testCaseNo: item.test_case_no,
            historyCount: item.historyCount ?? 0,
            fileNo: file.fileNo,
            fileName: file.name,
          });
          deletePromises.push(deleteEvidence(item.test_case_no, item.historyCount ?? 0, file.fileNo));
        }
      });
    });

    // 履歴データから新規追加されたエビデンスを削除
    pastTestCaseData.forEach((historyData, historyIndex) => {
      historyData.forEach((item) => {
        const key = `history_${historyIndex + 1}_${item.test_case_no}`;
        const initialIds = initialEvidenceIds.current.get(key) || new Set<number>();

        item.evidence?.forEach((file) => {
          if (file.fileNo !== undefined && !initialIds.has(file.fileNo)) {
            deletePromises.push(deleteEvidence(item.test_case_no, historyIndex + 1, file.fileNo));
          }
        });
      });
    });

    clientLogger.info('テスト結果登録画面', 'クリーンアップ削除対象数', { count: deletePromises.length });

    // すべての削除リクエストが完了するまで待機（keepaliveの場合は待機不要）
    if (!useKeepalive && deletePromises.length > 0) {
      await Promise.all(deletePromises);
      clientLogger.info('テスト結果登録画面', 'クリーンアップ完了');
    }
  }, [initialTestCaseData, pastTestCaseData, groupId, tid]);

  // タブクローズ・ページリロード・ブラウザバック時のクリーンアップ
  useEffect(() => {
    const handleBeforeUnload = () => {
      // keepalive: trueでリクエストを送信（ページアンロード後も継続）
      cleanupNewEvidences(true);
    };

    // ブラウザの戻る/進むボタン対応
    const handlePopState = () => {
      isNavigatingAway.current = true;
      // popstate時はすぐにクリーンアップを実行（keepalive: trueでリクエスト継続を保証）
      cleanupNewEvidences(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [cleanupNewEvidences]);

  const handleShowTestTable = () => {
    setShowNewTestCaseConduct(true);
    setButtonDisabled(true);
  };

  const toggleSection = (historyCount: number) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(historyCount)) {
        newSet.delete(historyCount);
      } else {
        newSet.add(historyCount);
      }
      return newSet;
    });
  };
  const handleSubmit = async () => {
    clientLogger.info('テスト結果登録画面', '登録ボタン押下');
    setErrors({});
    setIsLoading(true);
    // API呼び出し
    try {
      // 削除予定のエビデンスを収集して物理削除
      const deletedEvidences: Array<{
        file: FileInfo;
        testCaseNo: number;
        historyCount: number;
      }> = [];

      // 新規入力データから削除予定のエビデンスを収集
      if (showNewTestCaseConduct) {
        initialTestCaseData.forEach(item => {
          if (item.deletedEvidences && item.deletedEvidences.length > 0) {
            item.deletedEvidences.forEach(file => {
              deletedEvidences.push({
                file,
                testCaseNo: item.test_case_no,
                historyCount: item.historyCount ?? 0,
              });
            });
          }
        });
      }

      // 履歴データから削除予定のエビデンスを収集
      pastTestCaseData.forEach((historyData, historyIndex) => {
        historyData.forEach(item => {
          if (item.deletedEvidences && item.deletedEvidences.length > 0) {
            item.deletedEvidences.forEach(file => {
              deletedEvidences.push({
                file,
                testCaseNo: item.test_case_no,
                historyCount: historyIndex + 1,
              });
            });
          }
        });
      });

      // 削除予定のエビデンスを物理削除
      if (deletedEvidences.length > 0) {
        clientLogger.info('テスト結果登録画面', 'エビデンス削除開始', { count: deletedEvidences.length });

        for (const { file, testCaseNo, historyCount } of deletedEvidences) {
          try {
            await apiDelete('/api/files/evidences', {
              testGroupId: groupId,
              tid: tid,
              testCaseNo: testCaseNo,
              historyCount: historyCount,
              fileNo: file.fileNo,
            });
            clientLogger.info('テスト結果登録画面', 'エビデンス削除成功', {
              testCaseNo,
              historyCount,
              fileNo: file.fileNo,
            });
          } catch (deleteError) {
            clientLogger.error('テスト結果登録画面', 'エビデンス削除失敗', {
              error: deleteError,
              testCaseNo,
              historyCount,
              fileNo: file.fileNo,
            });
            // エビデンス削除失敗は警告のみで続行
          }
        }
      }

      // FileInfo[]をパス文字列の配列に変換するヘルパー
      const convertEvidenceToPathArray = (evidence: FileInfo[] | null): string[] => {
        if (!evidence) return [];
        return evidence.map(file => file.path || file.name).filter(Boolean);
      };

      // 再実施入力欄追加時のみ新規入力の結果を整形
      let newTestResultData;
      if (showNewTestCaseConduct) {
        newTestResultData = {
          historyCount: pastTestCaseData.length + 1,
          testResult: initialTestCaseData.map(item => ({
            test_case_no: item.test_case_no,
            test_case: item.test_case,
            expected_value: item.expected_value,
            result: item.result || '',
            judgment: item.judgment || JUDGMENT_OPTIONS.UNTOUCHED,
            softwareVersion: item.softwareVersion || '',
            hardwareVersion: item.hardwareVersion || '',
            comparatorVersion: item.comparatorVersion || '',
            executionDate: item.executionDate || '',
            executor: item.executor || '',
            evidence: convertEvidenceToPathArray(item.evidence),
            note: item.note || '',
          }))
        };
      }
      // 履歴の結果を整形
      const historyDataList = pastTestCaseData.map((historyData, index) => ({
        historyCount: index + 1,
        testResult: historyData.map(item => ({
          test_case_no: item.test_case_no,
          test_case: item.test_case,
          expected_value: item.expected_value,
          result: item.result || '',
          judgment: item.judgment || JUDGMENT_OPTIONS.UNTOUCHED,
          softwareVersion: item.softwareVersion || '',
          hardwareVersion: item.hardwareVersion || '',
          comparatorVersion: item.comparatorVersion || '',
          executionDate: item.executionDate || '',
          executor: item.executor || '',
          evidence: convertEvidenceToPathArray(item.evidence),
          note: item.note || '',
        }))
      }));
      // 整形した新規入力の結果と履歴の結果からAPIリクエストを作成。
      const combinedFormData = {
        newTestResultData,
        historyDataList
      }

      clientLogger.info('テスト結果登録画面', 'テスト結果登録開始', { combinedFormData });
      // ここでAPI呼び出しを行う
      const response = await apiPost<any>(`/api/test-groups/${groupId}/cases/${tid}/results`, combinedFormData);

      if (response.success) {
        // 登録成功フラグを設定（タブクローズ時のクリーンアップをスキップ）
        isRegistrationSuccessful.current = true;
        clientLogger.info('テスト結果登録画面', 'テスト結果登録成功', { tid: tid });
        setModalMessage('テスト結果を登録しました');
        setIsModalOpen(true);
        setTimeout(() => {
          router.push(`/testGroup/${groupId}/testCase/${tid}/result`);
        }, 1500);
      } else {
        clientLogger.error('テストケース結果登録画面', 'テストケース結果登録失敗', { error: response.error });
        setModalMessage('テストケース結果登録に失敗しました');
        setIsModalOpen(true);
      }
    } catch (error) {
      clientLogger.error('テストケース結果登録画面', 'テストケース結果登録エラー', { error });
      setModalMessage('テストケース結果登録に失敗しました');
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };
  const handleCancel = async () => {
    // ナビゲーションフラグを設定してクリーンアップを実行
    isNavigatingAway.current = true;
    // 削除完了を待ってからナビゲーション
    await cleanupNewEvidences(false);
    router.back();
  };

  return (
    <div className='space-y-4'>
      <h1 className="text-lg font-bold">テスト情報</h1>
      {data ? (
        <>
          <div>
            <div className="w-full">
              <TestCaseConduct labels={labelData} values={{
                tid: data.tid,
                firstLayer: data.first_layer,
                secondLayer: data.second_layer,
                thirdLayer: data.third_layer,
                fourthLayer: data.fourth_layer,
                purpose: data.purpose,
                checkItems: data.check_items,
                requestId: data.request_id,
                controlSpec: data.control_spec,
                dataFlow: data.data_flow,
                testProcedure: data.test_procedure
              }} />
            </div>
          </div>
          <div className="w-full flex items-end justify-end">
            <Button type="submit" onClick={handleShowTestTable} className="w-36" disabled={buttonDisabled}>
              再実施入力欄追加
            </Button>
          </div>
        </>
      ) : (
        <Loading
          isLoading={true}
          message={"データ読み込み中..."}
          size="md"
        />
      )}
      <div className="space-y-2">
        <h1 className="text-lg font-bold">テスト結果</h1>
        <div className="space-y-4">
          {isLoading ? (
            <Loading isLoading={isLoading} message="データ読み込み中..." size="md" />
          ) : (
            <>
              <>
                {showNewTestCaseConduct && user &&
                  <TestTable
                    groupId={groupId}
                    tid={tid}
                    data={initialTestCaseData}
                    setData={setInitialTestCaseData}
                    userName={user.name || ''}
                    executorsList={[{ id: user.id, name: user.name }]}
                    executorsPerRow={executorsPerRow}
                  />}
                {Object.entries(pastTestCaseData).length > 0 &&
                  (() => {

                    // セクションをレンダリング
                    return pastTestCaseData.slice().reverse().map((_row, reverseIndex) => {
                      const actualIndex = pastTestCaseData.length - 1 - reverseIndex; // 実際の配列のインデックスを保存
                      const historyCount = pastTestCaseData.length - reverseIndex;
                      const sectionLabel = historyCount === 0 ? '最新' : `${historyCount}回目`;
                      const isExpanded = expandedSections.has(historyCount);
                      return (
                        <div key={reverseIndex}>
                          <div className="border rounded-lg p-4 bg-gray-50">
                            <button
                              onClick={() => historyCount !== 0 && toggleSection(historyCount)}
                              className={`w-full text-left flex items-center justify-between ${historyCount !== 0 ? 'hover:bg-gray-100' : ''} rounded px-2 py-1 transition-colors`}
                              disabled={historyCount === 0}
                            >
                              <h2 className="text-md font-semibold text-gray-700">{sectionLabel}</h2>
                              {historyCount !== 0 && (
                                <span className="text-xl">{isExpanded ? '▼' : '▶'}</span>
                              )}
                            </button>
                            {isExpanded && (
                              <div className="overflow-x-auto mt-4">
                                <TestTable
                                  groupId={groupId}
                                  tid={tid}
                                  data={pastTestCaseData[actualIndex]}
                                  setData={(newData) => setPastTestCaseData(prevState => {
                                    const newState = [...prevState];
                                    if (typeof newData === 'function') {
                                      newState[actualIndex] = newData(newState[actualIndex]);
                                    } else {
                                      newState[actualIndex] = newData;
                                    }
                                    return newState;
                                  })}
                                  userName={user?.name || ''}
                                  executorsList={executorsList}
                                  executorsPerRow={executorsPerRow} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()
                }
              </>
              <div className="flex justify-center space-x-4">
                <Button type="submit" onClick={handleSubmit}>登録</Button>
                <Button type="button" onClick={handleCancel} className="bg-gray-500 hover:bg-gray-400">戻る</Button>
              </div>
            </>
          )}
        </div>
      </div>
      {loadError && (
        <div className="text-red-500 mt-4" role="alert">
          {loadError}
        </div>
      )}
      {/* 登録結果モーダル */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
    </div >
  );
}