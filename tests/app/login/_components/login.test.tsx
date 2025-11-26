import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { store } from '@/stores/store';
import { LoginFormContainer } from '@/app/login/_components/LoginFormContainer';
import React from 'react';

describe('LoginClient', () => {
  it('renders login form', () => {
    render(
      <Provider store={store}>
        <LoginFormContainer />
      </Provider>
    );
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
  });
});
