import { RootState } from '@/stores/store';
import { createSlice, PayloadAction, ThunkAction, Action } from '@reduxjs/toolkit';
import { clearAuthSession } from '@/stores/feature/auth';
import type { AuthSession } from '@/stores/feature/auth';
import { User } from '@/types';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login(state, action: PayloadAction<AuthSession>) {
      state.isAuthenticated = action.payload.isAuthenticated;
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    logout(state) {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
    },
  },
});

export const { login, logout } = authSlice.actions;

// ログアウトアクションのラッパー関数を作成（Thunk Action）
export const logoutWithCleanup =
  (): ThunkAction<void, RootState, unknown, Action> => (dispatch) => {
    clearAuthSession();
    dispatch(logout());
  };

export default authSlice.reducer;
