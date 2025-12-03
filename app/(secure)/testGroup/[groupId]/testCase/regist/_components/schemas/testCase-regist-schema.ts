import { z } from 'zod';

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
  controlSpecFile: z.instanceof(File).nullable()
    .refine((file) => file !== null, { message: '制御仕様書は必須項目です' }),
  dataFlowFile: z.instanceof(File).nullable()
    .refine((file) => file !== null, { message: 'データフローは必須項目です' }),
  testContents: z.array(z.object({
    id: z.number(),
    testCase: z.string(),
    expectedValue: z.string(),
    excluded: z.boolean(),
    selected: z.boolean(),
  })).optional(),
}).refine((data) => {
  // テスト内容が1件以上表示されている場合、全て記入されているか確認
  if (data.testContents && data.testContents.length > 0) {
    return data.testContents.every(tc => tc.testCase.trim() !== '' && tc.expectedValue.trim() !== '');
  }
  return true;
}, {
  message: 'テスト内容が表示されている場合、テストケースと期待値の両方を記入してください',
  path: ['testContents'],
});

export type TestCaseRegistFormData = z.infer<typeof testCaseRegistSchema>;
