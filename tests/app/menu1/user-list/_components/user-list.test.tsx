import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { store } from '@/stores/store';
import { UserList } from '@/app/(secure)/admin/user/_components/UserList';
import React from 'react';

describe('ListContent', () => {
  it('renders table headers', () => {
    render(
      <Provider store={store}>
        <UserList
          items={[]}
          columns={[]}
          sortConfig={null}
          onSort={() => { }}
          page={1}
          pageCount={1}
          onPageChange={() => { }}
        />
      </Provider>
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
