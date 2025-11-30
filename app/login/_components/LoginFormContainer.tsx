'use client';
import { useState, useEffect } from 'react';
import { loginSchema } from '@/app/login/_components/schemas/login-schema';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { login as loginAction } from '@/stores/feature/authSlice';
import Loading from '@/components/ui/loading';
import { LoginForm } from './LoginForm';
import { setAuthSession, generateToken } from '@/stores/feature/auth';
import { User } from '@/types';
import clientLogger from '@/utils/client-logger';
import { signIn, useSession } from 'next-auth/react';

export function LoginFormContainer() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: session, status } = useSession();

  // Redirect if already logged in
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
    clientLogger.info('LoginForm', 'ログインフォーム送信', { email: form.email });
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const result = loginSchema.safeParse(form);
    if (!result.success) {
      setErrorMsg('メールアドレスまたはパスワードが正しくありません。\n再度お試しください。');
      setLoading(false);
      return;
    }

    clientLogger.info('LoginForm', 'Form validation passed');

    try {
      const signInResult = await signIn('credentials', {
        redirect: false,
        email: form.email,
        password: form.password,
      });

      if (signInResult?.error) {
        setErrorMsg('メールアドレスまたはパスワードが正しくありません');
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

        clientLogger.info('LoginForm', 'Preparing to save session:', authSession);

        // セッションに保存を試みる
        try {
          setAuthSession(authSession);
          clientLogger.info('LoginForm', 'Session save completed');
          console.log('Session save completed');

          // Reduxストアの更新
          dispatch(loginAction(authSession));
          router.push('/testGroup', { scroll: false });
        } catch (error) {
          clientLogger.info('LoginForm', 'Error saving session:', error);
          setErrorMsg('メールアドレスまたはパスワードが正しくありません。\n再度お試しください。');
        }
      }
    } catch (error) {
      clientLogger.info('LoginForm', 'Error saving session:', error);
      setErrorMsg('ログインに失敗しました');
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