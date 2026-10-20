import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PLATFORM_CONFIGS, getPlatformColor } from "@/lib/platforms";
import type { ConnectedAccount, Platform } from "@/types/database";

export function UnconnectedPlatforms({ accounts }: { accounts: ConnectedAccount[] }) {
  const connected = new Set(accounts.map((a) => a.platform));
  const missing = PLATFORM_CONFIGS.filter((p) => !connected.has(p.id));
  if (missing.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {missing.map((p) => (
              <span
                key={p.id}
                className="grid h-8 w-8 place-items-center rounded-full text-white ring-2 ring-card"
                style={{ backgroundColor: getPlatformColor(p.id as Platform) }}
              >
                <p.icon className="h-4 w-4" />
              </span>
            ))}
          </div>
          <p className="text-sm">
            <span className="font-medium">{missing.map((p) => p.label).join(", ")}</span>{" "}
            <span className="text-muted-foreground">
              {missing.length === 1 ? "isn't" : "aren't"} connected yet — analytics and posts will show here once
              linked.
            </span>
          </p>
        </div>
        <Link to="/accounts" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Connect now <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
