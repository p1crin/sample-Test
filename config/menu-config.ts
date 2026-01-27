export type MenuItem = {
  id: string;
  label: string;
  path?: string;
  icon?: string;
  children?: MenuItem[];
};

export type MenuGroup = {
  id: string;
  label: string;
  items: MenuItem[];
};

export const menuConfig: MenuGroup[] = [
  {
    id: 'testmanager',
    label: 'テスト管理',
    items: [
      {
        id: 'testGroup',
        label: 'テストグループ一覧',
        path: '/testGroup',
      },

    ],
  },
  {
    id: 'importmanager',
    label: 'インポート管理',
    items: [
      {
        id: 'testImport',
        label: 'テストインポート',
        path: '/testImport',
      },
      {
        id: 'userImport',
        label: 'ユーザインポート',
        path: '/userImport',
      },
      {
        id: 'importResult',
        label: 'インポート結果一覧',
        path: '/importResult',
      },
    ],
  },
  {
    id: 'adminmenu',
    label: 'システム管理者用',
    items: [
      {
        id: 'usermanagement',
        label: 'ユーザ一覧',
        path: '/user',
      },
    ],
  },
];
