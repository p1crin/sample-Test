'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import clientLogger from '@/utils/client-logger';

interface Executor {
  id: number;
  name: string;
  email: string;
}

interface ExecutorSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (executorName: string) => void;
  userRole: string;
  currentUserId: number;
  currentUserName: string;
  groupId: number;
  tid: string;
  testCaseNo: number;
}

export const ExecutorSelectModal: React.FC<ExecutorSelectModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  userRole,
  currentUserId,
  currentUserName,
  groupId,
  tid,
  testCaseNo,
}) => {
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchExecutors = async () => {
      setLoading(true);
      setError(null);

      try {
        // 一般ユーザーの場合は自分自身のみ表示（APIから取得しない）
        if (userRole === '一般') {
          setExecutors([
            {
              id: currentUserId,
              name: currentUserName,
              email: '',
            },
          ]);
          setLoading(false);
          return;
        }

        clientLogger.info('ExecutorSelectModal', 'Fetching executors', { userRole, groupId, tid, testCaseNo });

        // ユーザーの役割に応じてAPIエンドポイントを選択
        let url = '';
        if (userRole === 'システム管理者') {
          // 管理者: 全ユーザーを取得
          url = '/api/users?limit=1000';
        } else if (userRole === 'テスト管理者') {
          // テスト管理者: テストグループに許可されたユーザーを取得
          url = `/api/test-groups/${groupId}/permitted-users`;
        }

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Failed to fetch executors');
        }

        const result = await response.json();

        let fetchedExecutors: Executor[] = [];

        if (userRole === 'システム管理者') {
          // 管理者の場合、ユーザー一覧から変換
          fetchedExecutors = result.data?.map((user: { id: number; name: string; email: string }) => ({
            id: user.id,
            name: user.name,
            email: user.email,
          })) || [];
        } else if (userRole === 'テスト管理者') {
          // テスト管理者の場合、許可されたユーザー一覧から変換
          fetchedExecutors = result.data?.map((user: { id: number; name: string; email: string }) => ({
            id: user.id,
            name: user.name,
            email: user.email,
          })) || [];
        }

        setExecutors(fetchedExecutors);
        clientLogger.info('ExecutorSelectModal', 'Executors fetched successfully', { count: fetchedExecutors.length });
      } catch (err) {
        clientLogger.error('ExecutorSelectModal', 'Failed to fetch executors', {
          error: err instanceof Error ? err.message : String(err),
        });
        setError('実施者の取得に失敗しました');

        // エラーの場合、少なくとも自分自身は選択できるようにする
        setExecutors([
          {
            id: currentUserId,
            name: currentUserName,
            email: '',
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchExecutors();
  }, [isOpen, userRole, groupId, tid, testCaseNo, currentUserId, currentUserName]);

  const handleSelect = (executor: Executor) => {
    onSelect(executor.name);
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">実施者を選択</h2>

        {loading && (
          <div className="text-center py-4">
            読み込み中...
          </div>
        )}

        {error && (
          <div className="text-red-500 mb-4">
            {error}
          </div>
        )}

        {!loading && executors.length > 0 && (
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {executors.map((executor) => (
                <button
                  key={executor.id}
                  onClick={() => handleSelect(executor)}
                  className="w-full text-left p-3 border border-gray-300 rounded hover:bg-gray-100"
                >
                  <div className="font-medium">{executor.name}</div>
                  {executor.email && (
                    <div className="text-sm text-gray-500">{executor.email}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && executors.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            選択可能な実施者がいません
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={onClose} className="bg-gray-500 hover:bg-gray-400">
            閉じる
          </Button>
        </div>
      </div>
    </Modal>
  );
};
