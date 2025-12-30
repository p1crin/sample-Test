'use client';
import * as React from 'react';
import { cn } from '@/utils/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'outline';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild = false, variant = 'default', ...props }, ref) => {
    const Comp = asChild ? ('span' as React.ElementType) : 'button';
    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none px-4 py-2',
          'hover:scale-105 active:scale-95 transition-transform duration-150',
          variant === 'outline'
            ? 'text-white bg-stnly hover:bg-stnly-light border stnly'
            : 'text-white bg-stnly hover:bg-stnly-light',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };