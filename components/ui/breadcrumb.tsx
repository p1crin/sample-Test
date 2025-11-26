"use client"
import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const Breadcrumb = () => {
  const pathname = usePathname();
  const pathnames = pathname.split('/').filter((x) => x);

  // keyとvalueの関係で定義
  const breadcrumbMap: { [key: string]: string } = {
    top: 'TOP',
    testGroup: 'テストグループ一覧',
    copy: '複製',
    testCase: 'テストケース一覧',
    result: 'テストケース結果確認',
    conduct: 'テストケース結果登録',
    importResult: 'インポート結果一覧',
    importInfo: 'インポート内容確認',
    admin: 'システム管理者用',
    user: 'ユーザ一覧',
    importExecute: 'インポート実施',
    regist: '新規登録',
    edit: '編集',
    testSummaryResult: 'テスト集計結果表示',
    password: 'パスワード変更'
  };

  return (
    <nav aria-label="breadcrumb">
      <ol style={{ display: 'flex', listStyle: 'none', padding: 0 }}>
        {pathnames.map((value, index) => {
          const href = `/${pathnames.slice(0, index + 1).join('/')}`;
          const displayValue = breadcrumbMap[value];
          return (
            displayValue && (
              <React.Fragment key={index}>
                {index > 0 && <li style={{ margin: '0 5px' }}> &gt; </li>}
                <li>
                  <Link href={href} style={{ textDecoration: 'underline' }}>{displayValue}</Link>
                </li>
              </React.Fragment>
            )
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;