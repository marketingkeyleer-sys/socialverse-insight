import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Brand, ConnectedAccount } from "@/types/database";

const DISMISS_KEY = "sv-setup-checklist-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// A short "what do I do next" list for new users. It reads straight from the
// user's real brands and accounts, so each step ticks itself off, and it goes
// away on its own once everything's done (or when dismissed).
export function SetupChecklist({
  brands,
  accounts,
  onCreateBrand,
}: {
  brands: Brand[];
  accounts: ConnectedAccount[];
  onCreateBrand: () => void;
}) {
  const [dismissed, setDismissed] = useState(wasDismissed);
  const inBrand = accounts.filter((a) => a.brand_id);
  const social = inBrand.filter((a) => a.platform !== "whatsapp");
  const whatsapp = accounts.find((a) => a.platform === "whatsapp");
  const waLinked = Boolean(whatsapp?.platform_username);

  const steps = [
    { done: brands.length > 0, title: "Create a brand", hint: "One business or product, e.g. RobotVerse.", action: brands.length ? null : <Button size="sm" onClick={onCreateBrand}>Create brand</Button> },
    { done: social.length > 0, title: "Connect a social account", hint: "Facebook, Instagram, YouTube or LinkedIn. Use Connect on a row below.", action: null },
    { done: waLinked, title: "Link WhatsApp (optional)", hint: "Scan a QR code to reach customers and groups.", action: whatsapp && !waLinked ? <Button asChild size="sm"><Link to={`/whatsapp?account=${whatsapp.id}`}>Scan QR</Link></Button> : null },
    { done: false, title: "Publish your first post", hint: "Write once and send to every connected platform.", action: <Button asChild size="sm" variant="outline"><Link to="/compose">Compose</Link></Button>, final: true },
  ];
  const required = steps.slice(0, 2);

  if (dismissed || required.every((s) => s.done) && (waLinked || !whatsapp) && social.length > 0 && brands.length > 0 && accounts.length >= 3) {
    return null;
  }

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">Get set up</p>
          <p className="text-xs text-muted-foreground">
            {steps.filter((s) => s.done).length} of {steps.length - 1} steps done
          </p>
        </div>
        <button
          type="button"
          aria-label="Hide checklist"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // Private mode: it just comes back next visit.
            }
            setDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="space-y-2.5">
        {steps.map((s) => (
          <li key={s.title} className="flex items-center gap-3">
            {s.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${s.done ? "text-muted-foreground line-through" : "font-medium"}`}>{s.title}</p>
              {!s.done && <p className="text-xs text-muted-foreground">{s.hint}</p>}
            </div>
            {!s.done && s.action}
          </li>
        ))}
      </ul>
    </Card>
  );
}
