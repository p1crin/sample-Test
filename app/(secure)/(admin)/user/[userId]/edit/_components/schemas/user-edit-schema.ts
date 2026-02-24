import { z } from 'zod';

export const userEditSchema = z.object({
  email: z.string()
    .email({ message: 'ID(メールアドレス)のフォーマットが異なります' })
    .min(1, { message: 'ID(メールアドレス)は必須項目です' })
    .max(255, { message: 'ID(メールアドレス)は255文字以内で入力してください' }),
  name: z.string()
    .min(1, { message: '氏名は必須項目です' })
    .max(255, { message: '氏名は255文字以内で入力してください' }),
  department: z.string()
    .min(1, { message: '部署は必須項目です' })
    .max(255, { message: '部署は255文字以内で入力してください' }),
  company: z.string()
    .min(1, { message: '会社名は必須項目です' })
    .max(255, { message: '会社名は255文字以内で入力してください' }),
  user_role: z.string()
    .min(1, { message: '権限は必須項目です' }),
  password: z.string()
    .regex(/^[!-~]+$/, { message: 'パスワードは半角で入力してください' })
    .regex(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[!-/:-@[-`{-~])/, { message: 'パスワードは大文字、小文字、数字、記号をそれぞれ1文字以上含む必要があります' })
    .refine((password) => password.length >= 8 && password.length <= 64, { message: 'パスワードは8文字以上64文字以下です' })
    .or(z.string().length(0)),
  tags: z.array(z.string()
    .refine((tag) => !tag.includes(",") && !tag.includes(";"), {
      message: 'タグには「;」または「,」を使用できません'
    })
  ),
  is_deleted: z.string()
    .min(1, { message: 'ステータスは必須項目です' })
});
