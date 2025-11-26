import { createSlice } from '@reduxjs/toolkit';

export interface SidebarState {
  open: boolean;
}

const initialState: SidebarState = {
  open: true,
};

export const sidebarSlice = createSlice({
  name: 'sidebar',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.open = !state.open;
    },
    setSidebarOpen: (state, action) => {
      state.open = action.payload;
    },
  },
});

export const { toggleSidebar, setSidebarOpen } = sidebarSlice.actions;
export default sidebarSlice.reducer;
