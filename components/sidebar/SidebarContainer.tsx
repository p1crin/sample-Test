import { Sidebar } from './Sidebar';

export function SidebarContainer({ open, role }: { open: boolean, role: number }) {
  return <Sidebar open={open} role={role} />;
}
