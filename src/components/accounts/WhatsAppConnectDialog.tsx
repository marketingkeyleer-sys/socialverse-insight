import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWhatsAppConnect } from "@/hooks/useWhatsApp";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

export function WhatsAppConnectDialog({
  open,
  brandId,
  onOpenChange,
}: {
  open: boolean;
  brandId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const connect = useWhatsAppConnect();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"bridge" | "cloud">("bridge");

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const ready = mode === "bridge" || (phoneNumberId.trim() && wabaId.trim() && accessToken.trim());

  function submit() {
    const input =
      mode === "bridge"
        ? ({ mode, brandId } as const)
        : ({
            mode,
            phoneNumberId: phoneNumberId.trim(),
            wabaId: wabaId.trim(),
            accessToken: accessToken.trim(),
            brandId,
          } as const);
    connect.mutate(input, {
      onSuccess: (data) => {
        setPhoneNumberId("");
        setWabaId("");
        setAccessToken("");
        onOpenChange(false);
        // A QR link is finished on the WhatsApp page, where the code is shown.
        if (input.mode === "bridge") navigate(`/whatsapp?account=${data.accountId}`);
      },
      onError: (e) => toast.error(e.message || "Could not connect WhatsApp"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect WhatsApp</DialogTitle>
          <DialogDescription>Choose how this number connects.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "bridge" | "cloud")}>
          <TabsList className="w-full">
            <TabsTrigger value="bridge" className="flex-1">
              Scan QR code (recommended)
            </TabsTrigger>
            <TabsTrigger value="cloud" className="flex-1">
              Official Cloud API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bridge" className="mt-4 space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Click <strong className="text-foreground">Show QR code</strong> below
              </li>
              <li>On your phone: WhatsApp, then Linked devices, then Link a device</li>
              <li>Scan the code. Your customers and groups are then ready to use</li>
            </ol>
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              This links your number the way WhatsApp Web does. WhatsApp's terms don't allow automation, so numbers that
              message people who haven't opted in, or send too fast, can be restricted or banned. Posts go out one at a time
              at a pace you choose, only to contacts you've confirmed opted in. Use a number you can afford to lose.
            </p>
          </TabsContent>

          <TabsContent value="cloud" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Official WhatsApp Business Cloud API. Customers only, using message templates you get approved in Meta (no
              groups). Find these values in your Meta app under WhatsApp, then API Setup.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="wa-phone-id">Phone number ID</Label>
              <Input
                id="wa-phone-id"
                inputMode="numeric"
                placeholder="e.g. 109876543210987"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-waba-id">WhatsApp Business Account ID</Label>
              <Input
                id="wa-waba-id"
                inputMode="numeric"
                placeholder="e.g. 102345678901234"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-token">Access token</Label>
              <Input
                id="wa-token"
                type="password"
                autoComplete="off"
                placeholder="System-user token (does not expire)"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Create a System User in Meta Business Settings, assign it your WhatsApp account, and generate a token with the{" "}
                <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code> permissions. Stored
                encrypted.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Optional: delivery receipts and STOP replies</p>
              <p className="mt-1">
                In your Meta app, under WhatsApp then Configuration, set the webhook callback URL to the address below and
                subscribe to <code>messages</code>.
              </p>
              <code className="mt-2 block break-all rounded bg-background p-2 text-foreground">{WEBHOOK_URL}</code>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={submit} disabled={!ready || connect.isPending}>
            {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "bridge" ? "Show QR code" : "Verify and connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
