import Link from 'next/link';
import { useState } from 'react';
import { MenuItem, menuConfig } from '@/config/menu-config';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { UserRole } from '@/types/database';

export type SidebarProps = {
  open: boolean;
  role: number;
};

export function Sidebar({ open, role }: SidebarProps) {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  // システム管理者でない場合、menuConfigからidが'adminmenu'の項目を削除
  let filteredMenuConfig;

  switch (role) {
    case UserRole.TEST_MANAGER:
      filteredMenuConfig = menuConfig.filter(item => item.id !== 'adminmenu');
      break;
    case UserRole.GENERAL:
      filteredMenuConfig = menuConfig.filter(item => item.id !== 'adminmenu' && item.id !== 'importmanager');
      break;
    default:
      filteredMenuConfig = menuConfig;
      break;
  }

  const toggleSubmenu = (menuId: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  };

  const renderMenuItem = (item: MenuItem) => {
    const isExpanded = expandedMenus.has(item.id);
    const isActive = item.path ? pathname.startsWith(item.path) : false;

    if (item.children) {
      return (
        <div key={item.id} className="space-y-1">
          <button
            type="button"
            className={`flex items-center w-full text-left font-semibold hover:underline focus:outline-none mt-2 ${isActive ? 'text-blue-700' : 'text-neutral-700'
              }`}
            onClick={() => toggleSubmenu(item.id)}
            aria-expanded={isExpanded}
            aria-controls={`${item.id}-submenu`}
          >
            {item.icon && (
              <span className="mr-2">
                <Image src={item.icon} alt="" width={16} height={16} />
              </span>
            )}
            <span className="flex-1">{item.label}</span>
            <svg
              className={`ml-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 18L15 12L9 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {isExpanded && (
            <div id={`${item.id}-submenu`} className="pl-4 space-y-1">
              {item.children.map((child) => renderMenuItem(child))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.path || '#'}
        className={`block font-semibold hover:underline ${isActive ? 'text-blue-700' : 'text-neutral-700'}`}
      >
        {item.icon && (
          <span className="mr-2">
            <Image src={item.icon} alt="" width={16} height={16} className="inline" />
          </span>
        )}
        {item.label}
      </Link>
    );
  };

  return (
    <aside
      className={`fixed top-16 left-0 min-h-screen h-[calc(100vh-4rem)] w-full sm:w-50 bg-neutral-100 border-r flex flex-col py-8 px-4 gap-4 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'
        } z-10`}
      style={{ minWidth: open ? '12rem' : 0 }}
    >
      <nav className="flex flex-col gap-6">
        {filteredMenuConfig.map((group) => (
          <div key={group.id} className="space-y-2">
            <div className="text-xs text-neutral-400 font-semibold tracking-wider select-none">
              {group.label}
            </div>
            <div className="space-y-1">{group.items.map((item) => renderMenuItem(item))}</div>
          </div>
        ))}
      </nav>
    </aside>
  );
}