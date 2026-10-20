import { NavLink } from "react-router-dom";
import { BarChart3, FileText, LayoutDashboard, PenSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/posts", label: "Posts", icon: FileText },
  { to: "/compose", label: "Compose", icon: PenSquare, primary: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "More", icon: Settings },
];

export function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t bg-background/95 backdrop-blur md:hidden">
      {TABS.map((tab) =>
        tab.primary ? (
          <NavLink
            key={tab.to}
            to={tab.to}
            className="flex flex-col items-center gap-1 text-primary-foreground"
            aria-label={tab.label}
          >
            <span className="grid h-11 w-11 -translate-y-3 place-items-center rounded-full bg-primary shadow-lg">
              <tab.icon className="h-5 w-5" />
            </span>
          </NavLink>
        ) : (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-[11px] font-medium",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
          </NavLink>
        ),
      )}
    </nav>
  );
}
