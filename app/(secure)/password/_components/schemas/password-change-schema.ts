import { z } from 'zod';

export const passwordChangeSchema = z.object({
  currentPassword: z.string()
    .refine((currentPassword) => currentPassword.length > 0, { message: 'パスワードは必須項目です' }),
  newPassword: z.string()
    .regex(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[!-/:-@[-`{-~])/, { message: '新しいパスワードは、大文字、小文字、数字、記号をそれぞれ1文字以上含む必要があります' })
    .refine((newPassword) => newPassword.length >= 8 && newPassword.length <= 64, { message: '新しいパスワードは8文字以上64文字以下です' })
    .refine((newPassword) => newPassword.length > 0, { message: '新しいパスワードは必須項目です' }),
  confirmPassword: z.string()
    .refine((confirmPassword) => confirmPassword.length > 0, { message: '新しいパスワード(再確認)は必須項目です' }),
}).superRefine(({ currentPassword, newPassword, confirmPassword }, ctx) => {
  if (currentPassword === newPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '現在のパスワードと異なる必要があります',
      path: ['newPassword'],
    });
  }
  if (newPassword !== confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '新しいパスワードと新しいパスワード(再確認)が一致しません',
      path: ['confirmPassword'],
    });
  }
});