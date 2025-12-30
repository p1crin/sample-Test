import React from 'react';

interface LoadingProps {
  /**
   * ローディング中かどうか
   */
  isLoading?: boolean;
  /**
   * 表示するメッセージ
   */
  message?: string;
  /**
   * フルスクリーン表示するかどうか
   */
  fullScreen?: boolean;
  /**
   * スピナーのサイズ
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * スピナーの色クラス
   */
  color?: string;
}

/**
 * ローディング表示コンポーネント
 *
 * 複数のバリアントをサポート：
 * - インラインスピナー（コンテナ内）
 * - フルスクリーン表示
 * - カスタマイズ可能なサイズと色
 */
const Loading: React.FC<LoadingProps> = ({
  isLoading = true,
  message = '読み込み中...',
  fullScreen = false,
  size = 'md',
  color = 'border-stnly',
}) => {
  // ローディング中でない場合は何も表示しない
  if (!isLoading) {
    return null;
  }

  // スピナーサイズの定義
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-4',
  };

  // スピナーのコンテナスタイル
  const containerClass = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-white bg-opacity-50 z-50'
    : 'flex items-center justify-center py-12';

  const contentClass = fullScreen
    ? 'bg-white rounded-lg shadow-lg p-8'
    : 'text-gray-500';

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        {/* スピナー */}
        <div
          className={`animate-spin h-10 w-10 border-4 rounded-full border-t-transparent ${sizeClasses[size]} ${color} mx-auto`}
        />
        {/* メッセージ */}
        {message && (
          <p className="mt-4 text-center text-gray-700 font-medium">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default Loading;