import { z } from 'zod';

const FileInfoSchema = z.object({
  name: z.string(),
  id: z.string(),
  base64: z.string().optional(),
  type: z.string().optional(),
});

export const testCaseEditSchema = z.object({
  tid: z.string()
    .min(1, { message: 'TIDは必須項目です' })
    .max(15, { message: 'TIDは15文字以内で入力してください' })
    .regex(/^([1-9][0-9]{0,2}-){3}[1-9][0-9]{0,2}$/, { message: 'TIDは「1～3桁の数字」を4つ、ハイフンで区切って入力してください（例: 123-45-6-789）' }),
  first_layer: z.string()
    .min(1, { message: '第1層は必須項目です' })
    .max(255, { message: '第1層は255文字以内で入力してください' }),
  second_layer: z.string()
    .min(1, { message: '第2層は必須項目です' })
    .max(255, { message: '第2層は255文字以内で入力してください' }),
  third_layer: z.string()
    .min(1, { message: '第3層は必須項目です' })
    .max(255, { message: '第3層は255文字以内で入力してください' }),
  fourth_layer: z.string()
    .min(1, { message: '第4層は必須項目です' })
    .max(255, { message: '第4層は255文字以内で入力してください' }),
  purpose: z.string()
    .min(1, { message: '目的は必須項目です' })
    .max(255, { message: '目的は255文字以内で入力してください' }),
  request_id: z.string()
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
  testCase: z.array(z.object({
    id: z.number(),
    testCase: z.string()
      .refine(tc => tc.trim() !== '', { message: `テストケースは必須です` }),
  })),
  expectedValue: z.array(z.object({
    id: z.number(),
    expectedValue: z.string()
      .refine(ev => ev.trim() !== '', { message: '期待値は必須です' }),
  })),
});

export type TestCaseRegistFormData = z.infer<typeof testCaseEditSchema>;