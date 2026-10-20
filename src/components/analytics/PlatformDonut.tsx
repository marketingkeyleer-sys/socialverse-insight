import { PlatformBreakdown } from "@/components/dashboard/PlatformBreakdown";
import type { ConnectedAccount } from "@/types/database";

export function PlatformDonut({ accounts }: { accounts: ConnectedAccount[] }) {
  return <PlatformBreakdown accounts={accounts} />;
}
