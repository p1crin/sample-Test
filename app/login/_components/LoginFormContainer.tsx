'use client';
import { loginSchema } from '@/app/login/_components/schemas/login-schema';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import clientLogger from '@/utils/client-logger';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoginForm } from './LoginForm';

export function LoginFormContainer() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: session, status } = useSession();

  // 認証済みならテストグループ一覧にリダイレクト
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/testGroup');
    }
  }, [status, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    clientLogger.info('ログイン画面', 'ログインボタン押下', { email: form.email });
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const result = loginSchema.safeParse(form);
    if (!result.success) {
      setErrorMsg(ERROR_MESSAGES.INVALID_CREDENTIALS);
      setLoading(false);
      return;
    }

    clientLogger.debug('ログイン画面', 'フォームバリデーション成功');

    try {
      const signInResult = await signIn('credentials', {
        redirect: false,
        email: form.email,
        password: form.password,
      });

      if (signInResult?.error) {
        setErrorMsg(ERROR_MESSAGES.INVALID_CREDENTIALS);
        clientLogger.error('ログイン画面', 'ログイン失敗:', signInResult.error);
      } else if (signInResult?.ok) {
        clientLogger.debug('ログイン画面', 'ログイン成功');
        // リダイレクトはuseSessionの変更で自動的に行われる
      }
    } catch (error) {
      clientLogger.error('ログイン画面', 'ログイン失敗:', error);
      setErrorMsg(ERROR_MESSAGES.LOGIN_FAILED);
    } finally {
      setLoading(false);
    }
  };

  // セッション読み込み中またはログイン済みの場合
  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p>セッションを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-gray-50">
      <LoginForm
        form={form}
        onChange={handleChange}
        onSubmit={handleSubmit}
        errorMsg={errorMsg}
      />
    </main>
  );
}
