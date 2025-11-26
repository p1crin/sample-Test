import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { store } from '@/stores/store';
import { UserEditForm } from '@/app/(secure)/admin/user/edit/_components/UserEditForm';
import React from 'react';

describe('EditContent', () => {
  it('renders breadcrumb', () => {
    render(
      <Provider store={store}>
        <UserEditForm
          id={1}
          form={{ name: '', role: '', dummy1: '', dummy2: '', dummy3: '', dummy4: '', dummy5: '', email: '', birthday: '', isActive: true, color: '', memo: '' }}
          errors={{}}
          toastOpen={false}
          onChange={() => { }}
          onClear={() => { }}
          onSubmit={() => { }}
          onToastClose={() => { }}
        />
      </Provider>
    );
    expect(screen.getByText("モーダルサンプル")).toBeInTheDocument();
  });
});
