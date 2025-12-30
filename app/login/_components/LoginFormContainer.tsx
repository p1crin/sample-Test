'use client';
import { loginSchema } from '@/app/login/_components/schemas/login-schema';
import Loading from '@/components/ui/loading';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { generateToken, setAuthSession } from '@/stores/feature/auth';
import { login as loginAction } from '@/stores/feature/authSlice';
import { User } from '@/types';
import clientLogger from '@/utils/client-logger';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { LoginForm } from './LoginForm';

export function LoginFormContainer() {
  const router = useRouter();
  const dispatch = useDispatch();
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
      } else if (signInResult?.ok) {
        const username = form.email.split("@")[0];
        const avatar = '/avatar-placeholder.svg';
        const token = generateToken(form.email);

        const loginDate = new Date();
        const serializeDate = () => {
          return JSON.stringify({ date: loginDate.toJSON() });
        };

        const authSession = {
          isAuthenticated: true,
          user: {
            email: form.email,
            name: username,
            avatar,
            role: 'general',
            id: token,
            createdAt: serializeDate(),
            updatedAt: serializeDate(),
          } as unknown as Pick<
            User,
            'email' | 'name' | 'avatar' | 'role' | 'id' | 'createdAt' | 'updatedAt'
          >,
          token,
        };

        clientLogger.debug('ログイン画面', 'セッション保存中:', authSession);

        // セッションに保存を試みる
        try {
          setAuthSession(authSession);
          clientLogger.debug('ログイン画面', 'セッション保存成功');

          // Reduxストアの更新
          dispatch(loginAction(authSession));
          router.push('/testGroup', { scroll: false });
        } catch (error) {
          clientLogger.error('ログイン画面', 'セッション保存失敗:', error);
          setErrorMsg(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }
      }
    } catch (error) {
      clientLogger.error('ログイン画面', 'セッション保存失敗:', error);
      setErrorMsg(ERROR_MESSAGES.LOGIN_FAILED);
    } finally {
      setLoading(false);
    }
  };

  // セッション読み込み中またはログイン済みの場合
  if (status === 'loading' || status === 'authenticated') {
    return (
      <Loading
        isLoading={true}
        message="セッションを読み込み中..."
        fullScreen={true}
        size="lg"
      />
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