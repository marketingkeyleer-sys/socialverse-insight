import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useBrandScope } from "@/contexts/BrandContext";

export function AppLayout({ children }: { children: ReactNode }) {
  const scope = useBrandScope();
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main key={scope.brandId} className="flex-1 pb-20 md:pb-0">
          {scope.isError ? <div role="alert" className="m-6 rounded-xl border border-destructive/30 p-5">Your brand workspace could not load. Refresh the page to try again.</div> : !scope.ready ? <div role="status" className="p-8 text-muted-foreground">Loading your brand workspace…</div> : children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
