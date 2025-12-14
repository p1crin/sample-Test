import { z } from 'zod';

const FileInfoSchema = z.object({
  name: z.string(),
  id: z.string(),
  base64: z.string().optional(),
  type: z.string().optional(),
});

export const testCaseRegistSchema = z.object({
  tid: z.string()
    .min(1, { message: 'TIDは必須項目です' })
    .max(255, { message: 'TIDは255文字以内で入力してください' }),
  firstLayer: z.string()
    .min(1, { message: '第1層は必須項目です' })
    .max(255, { message: '第1層は255文字以内で入力してください' }),
  secondLayer: z.string()
    .min(1, { message: '第2層は必須項目です' })
    .max(255, { message: '第2層は255文字以内で入力してください' }),
  thirdLayer: z.string()
    .min(1, { message: '第3層は必須項目です' })
    .max(255, { message: '第3層は255文字以内で入力してください' }),
  fourthLayer: z.string()
    .min(1, { message: '第4層は必須項目です' })
    .max(255, { message: '第4層は255文字以内で入力してください' }),
  purpose: z.string()
    .min(1, { message: '目的は必須項目です' })
    .max(255, { message: '目的は255文字以内で入力してください' }),
  requestId: z.string()
    .min(1, { message: '要求IDは必須項目です' })
    .max(255, { message: '要求IDは255文字以内で入力してください' }),
  checkItems: z.string()
    .min(1, { message: '確認観点は必須項目です' }),
  testProcedure: z.string()
    .min(1, { message: 'テスト手順は必須項目です' }),
  controlSpecFile: z.array(FileInfoSchema)
    .min(1, { message: '制御仕様書は必須項目です' }),
  dataFlowFile: z.array(FileInfoSchema)
    .min(1, { message: 'データフローは必須項目です' }),
  testContents: z.array(z.object({
    id: z.number(),
    testCase: z.string()
      .refine(tc => tc.trim() !== '', { message: 'テストケースは必須です' }),
    expectedValue: z.string()
      .refine(ev => ev.trim() !== '', { message: '期待値は必須です' }),
    excluded: z.boolean(),
    selected: z.boolean(),
  })).min(1, { message: 'テスト内容は最低1件必要です' }),
});

export type TestCaseRegistFormData = z.infer<typeof testCaseRegistSchema>;
