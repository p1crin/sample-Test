import { z } from 'zod';

export const testGroupEditSchema = z.object({
  name: z.string().min(1, { message: 'validation.name.required' }),
  role: z.enum(['一般', 'システム管理者'], {
    required_error: 'validation.role.required',
  }),
  dummy1: z.string().optional(),
  dummy2: z.string().optional(),
  dummy3: z.enum(['', 'A', 'B']).optional(),
  dummy4: z.union([z.string(), z.number()]).optional(), // 数値入力だが空文字も許容
  dummy5: z.string().optional(), // 日付（YYYY-MM-DD）形式の文字列
});
