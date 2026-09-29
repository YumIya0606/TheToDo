import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  className?: string;
}

export function PageHeader({ title, subtitle, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500", className)}>
      <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-tight">
        {title}
      </h2>
      <p className="text-slate-400 mt-1 text-sm font-medium">
        {subtitle}
      </p>
    </div>
  );
}