import React from 'react';
import { cn } from '@/lib/utils';

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20",
      secondary: "bg-slate-800 hover:bg-slate-700 text-slate-100",
      outline: "border border-slate-700 hover:bg-slate-800 text-slate-300",
      ghost: "hover:bg-slate-800/50 text-slate-400 hover:text-slate-100",
      danger: "bg-red-900/50 hover:bg-red-800/50 text-red-200 border border-red-900/50",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
      icon: "h-10 w-10 p-2",
    };

    return (
      <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />
    );
  }
);
Button.displayName = "Button";

// Input
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

// Card
export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm shadow-sm", className)}>
    {children}
  </div>
);

// Badge
export const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border", className)}>
    {children}
  </span>
);