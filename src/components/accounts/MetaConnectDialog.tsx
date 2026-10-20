import { useState } from "react";
import { ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPlatformIcon } from "@/lib/platforms";

export type MetaPlatform = "facebook" | "instagram";
export function MetaConnectDialog({platform, brandName, pending, error, onClose, onContinue}: {
  platform: MetaPlatform; brandName: string; pending: boolean; error?: string;
  onClose: () => void; onContinue: () => void;
}) {
  const [accountType, setAccountType] = useState<"ready" | "personal">("ready");
  const instagram = platform === "instagram";
  const Icon = getPlatformIcon(platform);
  const ready = accountType === "ready";
  return <Dialog open onOpenChange={open => {if(!open && !pending) onClose();}}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <span className={`mb-2 grid h-12 w-12 place-items-center rounded-xl ${instagram ? "bg-pink-500/10 text-pink-500" : "bg-blue-500/10 text-blue-600"}`}><Icon className="h-6 w-6"/></span>
        <DialogTitle>Connect {instagram ? "Instagram" : "a Facebook Page"}</DialogTitle>
        <DialogDescription>Sign in with Facebook, choose the {instagram ? "Instagram account" : "Page"} you manage, then confirm it in SocialVerse.</DialogDescription>
      </DialogHeader>
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">Connecting to <strong>{brandName}</strong></div>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Which account do you have?</legend>
        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${ready ? "border-primary bg-primary/5" : ""}`}><input type="radio" name="meta-account-type" value="ready" checked={ready} onChange={() => setAccountType("ready")} className="mt-1 accent-primary"/><span><span className="block text-sm font-medium">{instagram ? "Business or Creator account" : "I manage a Facebook Page"}</span><span className="mt-1 block text-xs text-muted-foreground">{instagram ? "A professional Instagram account linked to a Facebook Page." : "Use your normal Facebook login to authorize a Page you manage."}</span></span></label>
        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${!ready ? "border-primary bg-primary/5" : ""}`}><input type="radio" name="meta-account-type" value="personal" checked={!ready} onChange={() => setAccountType("personal")} className="mt-1 accent-primary"/><span><span className="block text-sm font-medium">{instagram ? "Personal Instagram account" : "I only have a personal Facebook profile"}</span><span className="mt-1 block text-xs text-muted-foreground">A quick setup is needed before connecting.</span></span></label>
      </fieldset>
      {!ready ? <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm">
        <p className="font-semibold">{instagram ? "Switch to a professional account first" : "Create or get access to a Page"}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{instagram ? "Meta supports Business and Creator accounts for this integration. A personal Instagram account cannot connect directly." : "Your normal Facebook account is used to sign in. SocialVerse manages Pages; personal-profile posting and analytics are not available through this integration."}</p>
        <ol className="list-inside list-decimal space-y-2 text-xs leading-relaxed">
          {instagram ? <><li>In Instagram settings, search for “Switch to professional account” and choose Business or Creator.</li><li>Link it to a Facebook Page you manage.</li><li>Return here and continue with the Facebook account that has access to that Page.</li></> : <><li>Create a Facebook Page for your brand, or ask its owner to give you the required Page access.</li><li>Return here and sign in with your own Facebook account.</li><li>Authorize the Page and choose it in SocialVerse.</li></>}
        </ol>
        <a className="inline-flex items-center gap-1 text-xs font-medium text-primary underline" href={instagram ? "https://www.facebook.com/business/help" : "https://www.facebook.com/pages/create/"} target="_blank" rel="noreferrer">{instagram ? "Open Meta setup help" : "Create a Facebook Page"}<ExternalLink className="h-3 w-3"/></a>
        <Button variant="outline" size="sm" className="w-full" onClick={() => setAccountType("ready")}>I've completed setup</Button>
      </div> : <div className="space-y-3 py-1">{[
        "Sign in on Facebook’s secure website. SocialVerse never asks for your Facebook password.",
        instagram ? "Allow access to the linked Page and professional Instagram account you want to connect." : "Allow access to the Page you want to manage. You choose what to authorize.",
        "Return to SocialVerse, select an authorized account and click Connect selected.",
      ].map((text,index) => <div key={text} className="flex gap-3 text-xs leading-relaxed"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{index+1}</span><p>{text}</p></div>)}
        <p className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">Missing a Page or Instagram account? Check that you signed in with the right Facebook account, have the required Page access, and selected that asset in Meta's permission screen.</p>
      </div>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button><Button disabled={!ready || pending} onClick={onContinue}>{pending ? "Opening Facebook…" : "Continue with Facebook"}<ArrowRight className="ml-2 h-4 w-4"/></Button></DialogFooter>
      <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><CheckCircle2 className="h-3 w-3"/>Connection does not publish a post. Publishing needs the platform's permissions.</p>
    </DialogContent>
  </Dialog>;
}
