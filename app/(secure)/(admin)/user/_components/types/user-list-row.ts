
type BaseUserListRow = {
  id: number;
  name: string;
  email: string;
  department: string;
  company: string;
  tags: string[];
};

// 項目のエンティティ型
export type UserListRow = BaseUserListRow & {
  user_role: number,
  is_deleted: boolean;
};

// 項目表示時のエンティティ型
export type UserListTableRow = BaseUserListRow & {
  user_role: string,
  is_deleted: string;
};

// 項目作成時の入力型
export type CreateUserListRow = Omit<UserListTableRow, 'id' | 'createdAt' | 'updatedAt'> & {
  password: string;
};

// 項目更新時の入力型
export type UpdateUserListRow = CreateUserListRow;
