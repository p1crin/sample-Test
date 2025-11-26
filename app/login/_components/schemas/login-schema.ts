import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email({ message: 'validation.email.format' }),
  password: z.string().min(1, { message: 'validation.password.required' }),
});
