import { z } from 'zod';

export const testCaseEditSchema = z.object({
  name: z.string().min(1, { message: 'validation.name.required' }),
  role: z.enum(['一般', 'システム管理者'], {
    required_error: 'validation.role.required',
  }),
});
