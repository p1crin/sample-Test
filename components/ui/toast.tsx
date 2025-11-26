'use client';
import * as React from 'react';
import { cn } from '@/utils/utils';

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
    open: boolean;
    onClose?: () => void;
    children: React.ReactNode;
}

export function Toast({ open, onClose, children, className, ...props }: ToastProps) {
    React.useEffect(() => {
        if (!open) return;
        const timer = setTimeout(() => {
            onClose?.();
        }, 4000);
        return () => clearTimeout(timer);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div
            className={cn(
                'fixed bottom-6 right-6 z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-6 py-4 flex items-center gap-4 animate-fade-in-up',
                className
            )}
            {...props}
        >
            {children}
            <button
                className="ml-4 text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none"
                onClick={onClose}
                aria-label="閉じる"
            >
                ×
            </button>
        </div>
    );
}