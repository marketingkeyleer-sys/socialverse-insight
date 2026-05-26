import { Link } from "@tanstack/react-router";
import { Brand } from "./brand";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Brand />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground transition">Features</a>
          <a href="#platforms" className="hover:text-foreground transition">Platforms</a>
          <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
          <a href="#testimonials" className="hover:text-foreground transition">Customers</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">Sign in</Link>
          <Link
            to="/dashboard"
            className="rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-background shadow-glow transition hover:opacity-90"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
