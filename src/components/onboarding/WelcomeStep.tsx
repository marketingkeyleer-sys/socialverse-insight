import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  const { profile } = useAuth();

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-8 w-8" />
      </span>
      <h1 className="text-2xl font-semibold">Welcome, {profile?.full_name?.split(" ")[0] ?? "there"}!</h1>
      <p className="max-w-sm text-muted-foreground">
        Let's get your workspace set up so you can start managing every social channel from one place.
      </p>
      <Button onClick={onNext} size="lg" className="mt-2">
        Let's get started
      </Button>
    </div>
  );
}
