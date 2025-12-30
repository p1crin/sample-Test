import { z } from 'zod';

export const testGroupRegistSchema = z.object({
  oem: z.string()
    .min(1, { message: 'OEMは必須項目です' })
    .max(255, { message: 'OEMは255文字以内で入力してください' }),
  model: z.string()
    .min(1, { message: '機種は必須項目です' })
    .max(255, { message: '機種は255文字以内で入力してください' }),
  event: z.string()
    .min(1, { message: 'イベントは必須項目です' })
    .max(255, { message: 'イベントは255文字以内で入力してください' }),
  variation: z.string()
    .min(1, { message: 'バリエーションは必須項目です' })
    .max(255, { message: 'バリエーションは255文字以内で入力してください' }),
  destination: z.string()
    .min(1, { message: '仕向は必須項目です' })
    .max(255, { message: '仕向は255文字以内で入力してください' }),
  specs: z.string()
    .min(1, { message: '制御仕様名は必須項目です' }),
  test_startdate: z.string()
    .min(1, { message: '試験開始日は必須項目です' }),
  test_enddate: z.string()
    .min(1, { message: '試験終了日は必須項目です' }),
  ngPlanCount: z.string()
    .min(1, { message: '不具合摘出予定数は必須項目です' })
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 9999, {
      message: '不具合摘出予定数は0件〜9999件の範囲で入力してください'
    }),
  designerTag: z.array(z.string()).optional(),
  executerTag: z.array(z.string()).optional(),
  viewerTag: z.array(z.string()).optional(),
}).refine((data) => {
  if (data.test_startdate && data.test_enddate) {
    return new Date(data.test_startdate) <= new Date(data.test_enddate);
  }
  return true;
}, {
  message: '試験開始日は試験終了日以前である必要があります',
  path: ['test_enddate'],
});