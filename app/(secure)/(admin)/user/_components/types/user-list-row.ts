import { RoleOption } from "@/constants/constants";

type BaseUserListRow = {
  name: string;
  email: string;
  role: RoleOption;
  department: string;
  company: string;
  tag: string;
};

// 項目のエンティティ型
export type UserListRow = BaseUserListRow & {
  status: boolean;
};

// 項目表示時のエンティティ型
export type UserListTableRow = BaseUserListRow & {
  status: string;
};

// 項目作成時の入力型
export type CreateUserListRow = Omit<UserListRow, 'id' | 'createdAt' | 'updatedAt'>;

// 項目更新時の入力型
export type UpdateUserListRow = Partial<CreateUserListRow>;
