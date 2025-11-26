// ユーザー関連のエンティティ型
export type User = {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: 'general' | 'admin';
  createdAt: Date;
  updatedAt: Date;
};

// ユーザー作成時の入力型
export type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;

// ユーザー更新時の入力型
export type UpdateUserInput = Partial<CreateUserInput>;
