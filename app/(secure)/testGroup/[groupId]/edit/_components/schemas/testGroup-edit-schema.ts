import { z } from 'zod';

export const testGroupEditSchema = z.object({
  oem: z.string().min(1, { message: 'OEMは必須項目です' }),
  model: z.string().min(1, { message: '機種は必須項目です' }),
  event: z.string().optional(),
  variation: z.string().optional(),
  destination: z.string().optional(),
  specs: z.string().optional(),
  test_startdate: z.string().optional(),
  test_enddate: z.string().optional(),
  ngPlanCount: z.string().optional(),
  designerTag: z.array(z.string()).optional(),
  executerTag: z.array(z.string()).optional(),
  viewerTag: z.array(z.string()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
