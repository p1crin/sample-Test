import { Button } from '@/components/ui/button';
import React from 'react';
import type { User } from '@/types';

type LoginFormData = {
  email: User['email'];
  password: string;
};

export type LoginFormProps = {
  form: LoginFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  errorMsg: string;
};

export function LoginForm({
  form,
  onChange,
  onSubmit,
  errorMsg,
}: LoginFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-4 sm:p-8 rounded shadow-md w-full max-w-sm flex flex-col gap-4 max-h-full justify-center overflow-auto"
    >
      <h1 className="text-2xl font-bold mb-2 sm:mb-4 text-center">ログイン</h1>
      <label className="flex flex-col gap-1" htmlFor="email">
        メールアドレス
        <input
          id="email"
          type="text"
          placeholder="メールアドレス"
          className="border rounded px-3 py-2"
          value={form.email}
          onChange={onChange}
          autoFocus
          maxLength={255}
        />
      </label>
      <label className="flex flex-col gap-1" htmlFor="password">
        パスワード
        <input
          id="password"
          type="password"
          placeholder={'パスワード'}
          className="border rounded px-3 py-2"
          value={form.password}
          onChange={onChange}
        />
      </label>
      {errorMsg && <div className="text-red-600">{errorMsg}</div>}
      <Button
        type="submit"
      >
        ログイン
      </Button>
    </form>
  );
}