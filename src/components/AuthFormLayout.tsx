import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";

export function AuthFormLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-semibold text-lg tracking-[0.18em]">GHARPAYY</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Core Arena
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
          <div className="mb-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
              Account
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

export function AuthNavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-primary font-medium hover:underline">
      {children}
    </Link>
  );
}
