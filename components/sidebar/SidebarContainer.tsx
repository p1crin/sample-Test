import { Sidebar } from './Sidebar';

export function SidebarContainer({ open, role, hasDesignerTag }: { open: boolean, role: number, hasDesignerTag?: boolean }) {
  return <Sidebar open={open} role={role} hasDesignerTag={hasDesignerTag} />;
}
