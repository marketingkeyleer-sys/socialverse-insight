import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  PenSquare,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { APP_NAME, PLAN_LIMITS } from "@/lib/constants";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/accounts", label: "Accounts", icon: Users },
  { to: "/compose", label: "Compose", icon: PenSquare },
  { to: "/manual-publish", label: "Personal publishing", icon: FileText },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/posts", label: "Posts", icon: FileText },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/ads", label: "Ads Manager", icon: Megaphone },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile } = useAuth();
  const planTier = profile?.plan_tier ?? "free";

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200 md:flex",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
          <NavLink to="/dashboard" className="text-lg font-semibold tracking-tight hover:opacity-80">
            {APP_NAME}
          </NavLink>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-3">
        {!collapsed && <div className="mb-2 flex gap-4 px-2 text-xs text-muted-foreground"><NavLink to="/privacy" className="hover:underline">Privacy</NavLink><NavLink to="/terms" className="hover:underline">Terms</NavLink></div>}
        <div className={cn("flex items-center gap-2 rounded-lg p-2", collapsed && "justify-center")}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? "You"} />
            <AvatarFallback>{(profile?.full_name ?? profile?.email ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.full_name ?? profile?.email}</p>
              <Badge variant="secondary" className="mt-0.5 text-[10px] capitalize">
                {PLAN_LIMITS[planTier].label}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
