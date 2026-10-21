import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPlatformConfig } from "@/lib/platforms";
import type { PlatformAvailability } from "@/hooks/useConnectionStatus";

export type GuidedPlatform = "youtube" | "linkedin" | "linkedin_page";

const GUIDES: Record<GuidedPlatform, { account: string; steps: string[]; note: string }> = {
  youtube: {
    account: "A Google account that owns or manages your YouTube channel.",
    steps: ["Sign in to Google and choose the account for this channel.", "Select the correct YouTube channel or Brand Account and review the requested access.", "Return here, select the authorized channel and confirm the connection."],
    note: "If Google blocks access or shows an unverified-app warning, the application owner must complete Google's review. Switching accounts cannot remove that requirement.",
  },
  linkedin: {
    account: "Your own LinkedIn member account. For a company, choose LinkedIn Page instead.",
    steps: ["Sign in on LinkedIn's secure website.", "Review the access requested by SocialVerse.", "Return here and confirm your member profile."],
    note: "Profile connection and publishing are separate permissions. Publishing needs LinkedIn's Share on LinkedIn product and your consent; profile sign-in alone does not enable posts or follower analytics.",
  },
  linkedin_page: {
    account: "A LinkedIn account with administrator access to the company Page.",
    steps: ["Sign in with the LinkedIn account that administers the company Page.", "Review access to the company's authorized assets.", "Select the correct company Page and confirm it for this brand."],
    note: "Company Page access uses the connection provider configured by your administrator. Brands connected through Upload-Post are verified against their selected company Page before confirmation. Other connections require this application's LinkedIn Community Management API approval.",
  },
};

export function PlatformConnectDialog({ platform, brandName, availability, pending, error, onClose, onContinue }: {
  platform: GuidedPlatform; brandName: string; availability: PlatformAvailability;
  pending: boolean; error?: string; onClose: () => void; onContinue: () => void;
}) {
  const config = getPlatformConfig(platform);
  const Icon = config.icon;
  const guide = GUIDES[platform];
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <span className="mb-2 grid h-12 w-12 place-items-center rounded-xl text-white" style={{ backgroundColor: config.color }}><Icon className="h-6 w-6" /></span>
        <DialogTitle>Connect {config.label}</DialogTitle>
        <DialogDescription>{guide.account}</DialogDescription>
      </DialogHeader>
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs">Connecting to <strong>{brandName}</strong></p>
      <ol className="list-decimal space-y-3 pl-5 text-sm">{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>
      <p className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">{guide.note}</p>
      {!availability.ready && <p role="status" className="rounded-lg border p-3 text-sm">{availability.reason} Contact your workspace administrator to enable this platform.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button disabled={pending || !availability.ready} onClick={onContinue}>{pending ? "Opening…" : `Continue with ${platform === "youtube" ? "Google" : "LinkedIn"}`}<ArrowRight className="ml-2 h-4 w-4" /></Button></DialogFooter>
      <p className="text-xs text-muted-foreground">Your password stays with the platform. Connecting an account does not publish content.</p>
    </DialogContent>
  </Dialog>;
}
