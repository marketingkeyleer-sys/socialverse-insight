import { useState } from "react";
import { CheckCircle2, Loader2, QrCode, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useBridgeStatus } from "@/hooks/useWhatsApp";

// Where you link (or unlink) your phone for a QR-connected WhatsApp account.
// The QR comes from the bridge through an Edge Function; WhatsApp rotates it
// every ~20 seconds, and this polls fast enough to always show the live one.
export function BridgeLinkPanel({ accountId }: { accountId: string }) {
  const { data: status, isLoading, error, refetch, session, pairingCode } = useBridgeStatus(accountId);
  const [phone, setPhone] = useState("");
  const busy = session.isPending;

  if (isLoading) return <Skeleton className="h-28" />;

  if (error || !status) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-sm">
            <p className="font-medium text-destructive">Can't reach your WhatsApp bridge</p>
            <p className="text-muted-foreground">{error instanceof Error ? error.message : "Check that it is running."}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status.state === "ready") {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <div className="text-sm">
              <p className="font-medium">Linked{status.account?.name ? ` as ${status.account.name}` : ""}</p>
              <p className="text-muted-foreground">{status.account?.phone ? `+${status.account.phone}` : "WhatsApp connected"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => session.mutate("restart")}>
              {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
              Restart
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={busy}>
                  Unlink
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unlink this WhatsApp number?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The bridge logs out of this number's linked device. Broadcasts still waiting to send will stop until you
                    scan a QR code again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => session.mutate("logout")}>Unlink</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status.state === "qr" && status.qr) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-start">
          <img src={status.qr} alt="WhatsApp QR code" className="h-56 w-56 rounded-lg border bg-white p-1" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">Scan to link your WhatsApp</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Open WhatsApp on your phone</li>
              <li>Go to Settings, then Linked devices (on Android: the three-dot menu)</li>
              <li>Tap Link a device and point the camera at this code</li>
            </ol>
            <p className="text-xs text-muted-foreground">The code refreshes by itself. This page updates as soon as it's scanned.</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => session.mutate("restart")}>
              Get a fresh code
            </Button>
            <div className="mt-2 space-y-2 border-t pt-3">
              <p className="font-medium">On this phone and can't scan?</p>
              {pairingCode.data ? (
                <>
                  <p className="select-all rounded-md bg-muted px-3 py-2 text-center font-mono text-2xl tracking-widest">
                    {pairingCode.data}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    In WhatsApp go to Linked devices, then Link a device, then "Link with phone number instead", and type this code.
                  </p>
                </>
              ) : (
                <div className="flex gap-2">
                  <Input
                    className="h-8"
                    inputMode="numeric"
                    placeholder="Your number, e.g. 919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <Button size="sm" disabled={!phone.trim() || pairingCode.isPending} onClick={() => pairingCode.mutate(phone)}>
                    {pairingCode.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Get code"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const loading = ["starting", "authenticating", "qr"].includes(status.state);
  return (
    <Card className={status.state === "error" ? "border-destructive/40" : undefined}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3 text-sm">
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <QrCode className="h-5 w-5 text-muted-foreground" />}
          <div>
            <p className="font-medium">
              {status.state === "starting" && "Starting WhatsApp…"}
              {status.state === "authenticating" && "Linking your phone…"}
              {status.state === "qr" && "Preparing the QR code…"}
              {status.state === "disconnected" && "WhatsApp isn't linked yet"}
              {status.state === "error" && "WhatsApp hit a problem"}
            </p>
            {(status.error || status.state === "disconnected") && (
              <p className="text-muted-foreground">
                {status.error || "Link your phone to start sending to customers and groups."}
              </p>
            )}
          </div>
        </div>
        {!loading && (
          <Button size="sm" disabled={busy} onClick={() => session.mutate(status.state === "error" ? "restart" : "start")}>
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {status.state === "error" ? "Restart" : "Show QR code"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
